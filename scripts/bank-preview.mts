// npm run bank:preview              – dry run: reads the bank (read-only) and shows what would be imported, writes nothing
// npm run bank:preview -- --apply   – makes a backup, imports, and approves the bank sync (the app syncs on its own after this)
//
// Until this has been applied once, the app never imports bank payments by itself (bank_connection.import_approved_at).
// Output is masked (first letters only) so it can be shown in chat; amounts and dates are shown in full.
// Same code path as the app: lib/bank/import.ts (dedup + matching).
import { BANK_IMPORT_FROM, maskIban, maskName } from "../lib/bank/constants.ts";
import { isRateLimited, spendCall, type BankCall } from "../lib/bank/budget.ts";
import { isBankConfigured, listTransactions, type BankAccount } from "../lib/bank/enable-banking.ts";
import { fromTransaction, insertPlanned, planImport, type Candidate } from "../lib/bank/import.ts";
import { adminClient, writeBackup } from "./tables.mts";

const apply = process.argv.includes("--apply");

if (!isBankConfigured()) {
  console.error("Trūksta ENABLE_BANKING_APP_ID arba ENABLE_BANKING_PRIVATE_KEY faile .env.local.");
  process.exit(1);
}

const supabase = adminClient();
const { data: conn, error } = await supabase
  .from("bank_connection")
  .select("owner_id, session_id, accounts, valid_until, import_approved_at, bank_calls, retry_after")
  .not("session_id", "is", null)
  .limit(1)
  .maybeSingle();
if (error) throw new Error(error.message);
if (!conn) {
  console.error("Bankas dar neprijungtas: Nustatymai → Bankas → „Prijungti banką“.");
  process.exit(1);
}

const accounts = conn.accounts as BankAccount[];
// A script run is a background request for the bank (no PSU headers) – it uses the same 4-per-24-h budget as the cron.
if (isRateLimited(conn.retry_after)) {
  console.error(`Bankas riboja užklausas iki ${conn.retry_after} – bandyk vėliau.`);
  process.exit(1);
}
let calls = conn.bank_calls as BankCall[];
const before = async (account: string) => {
  const next = spendCall(calls, account, false);
  if (!next) throw new Error("Foninių užklausų bankui per 24 h nebeliko (4 iš 4) – bandyk vėliau arba spausk „Sinchronizuoti dabar“ produkcijoje.");
  const { error: e } = await supabase.from("bank_connection").update({ bank_calls: next }).eq("owner_id", conn.owner_id);
  if (e) throw new Error(e.message);
  calls = next;
};
console.log(`Sąskaitos: ${accounts.map((a) => `${maskIban(a.iban)} (${a.currency ?? "?"})`).join(", ")}`);
console.log(`Sutikimas galioja iki: ${conn.valid_until ?? "?"}`);
console.log(`Laikotarpis: nuo ${BANK_IMPORT_FROM} iki šiandien\n`);

let total = 0;
let outgoing = 0;
const candidates: Candidate[] = [];
for (const account of accounts) {
  if (account.currency && account.currency !== "EUR") continue;
  const txs = await listTransactions(account.uid, BANK_IMPORT_FROM, before);
  total += txs.length;
  for (const tx of txs) {
    if (tx.credit_debit_indicator === "DBIT") outgoing++;
    const c = fromTransaction(tx);
    if (c) candidates.push(c);
  }
}

const { planned, duplicates } = await planImport(supabase, conn.owner_id, candidates, "bank");
const { data: students } = await supabase.from("students").select("id, first_name");
const studentName = new Map((students ?? []).map((s) => [s.id, s.first_name]));

/** "Už spalio pamokas 10" → "U* s* p* 10" – words masked, short numbers kept. */
const maskText = (t: string | null) =>
  (t ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (/^\d{1,4}$/.test(w) ? w : /\d/.test(w) ? "#" : `${w[0]}*`))
    .join(" ") || "–";

console.log(`Banko operacijų: ${total} (išlaidų: ${outgoing}, kitų neimportuojamų: ${total - outgoing - candidates.length})`);
console.log(`Gautų mokėjimų: ${candidates.length} · nauji: ${planned.length} · jau yra Chalk'e: ${duplicates.length}\n`);

for (const p of planned) {
  const who = p.student_id ? `→ ${maskName(studentName.get(p.student_id))} (pagal ${p.matched_by === "iban" ? "IBAN" : "vardą"})` : "→ nepriskirtas";
  console.log(
    `${p.booked_on}  ${p.amount.toFixed(2).padStart(8)} €  ${maskName(p.payer_name).padEnd(14)} ${maskIban(p.payer_iban).padEnd(14)} ${maskText(p.remittance).slice(0, 40).padEnd(40)} ${who}`
  );
}
const sum = planned.reduce((s, p) => s + p.amount, 0);
console.log(`\nIš viso naujų: ${planned.length} · ${sum.toFixed(2)} € · priskirta automatiškai: ${planned.filter((p) => p.student_id).length}`);

if (!apply) {
  console.log("\nNieko neįrašyta. Importuoti: npm run bank:preview -- --apply");
  process.exit(0);
}

const backup = await writeBackup(supabase);
console.log(`\nAtsarginė kopija: ${backup}`);
const inserted = await insertPlanned(supabase, conn.owner_id, planned, "bank");
const now = new Date().toISOString();
const { error: updateError } = await supabase
  .from("bank_connection")
  .update({ import_approved_at: conn.import_approved_at ?? now, last_sync_at: now, last_attempt_at: now, last_imported: inserted, last_error: null })
  .eq("owner_id", conn.owner_id);
if (updateError) throw new Error(updateError.message);
console.log(`Importuota: ${inserted}. Banko sinchronizacija įjungta – toliau Chalk tikrins pats.`);
