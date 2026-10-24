"use server";

import { revalidatePath } from "next/cache";
import { displayNames } from "@/lib/names";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fullNameKey, normIban, type BankInfo } from "./constants";
import { deleteSession } from "./enable-banking";
import { aliasToRemember, insertPlanned, loadAliases, matchStudent, planImport, type Alias } from "./import";
import { parseStatement, StatementError } from "./statement";
import { requestPsuHeaders, syncBank } from "./sync";

// Bank payments (bank sync / statement): assign, re-assign, unassign, hide – never delete (SPEC §1 Payments).
// Plus the Nustatymai → Bankas buttons. Payment writes go through RLS (owner only); the DB trigger
// payments_keep_bank_data makes sure the bank's own data can't change.

export type BankActionResult = { ok: true; message: string } | { ok: false; message: string };

const fail = (message: string): BankActionResult => ({ ok: false, message });
const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const SAVE_FAILED = "Nepavyko išsaugoti. Pabandyk dar kartą.";

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const ownerId = data?.claims?.sub;
  if (!ownerId) throw new Error("Neprisijungta.");
  return { supabase, ownerId };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function loadBankPayment(supabase: Supabase, id: string) {
  const { data } = await supabase.from("payments").select("id, source, student_id, payer_name, payer_iban").eq("id", id).maybeSingle();
  return data && data.source !== "manual" ? data : null;
}

/** The aliases that describe this payer (same IBAN, or the same full name). */
const aliasesOf = (aliases: Alias[], p: { payer_name: string | null; payer_iban: string | null }) => {
  const iban = normIban(p.payer_iban);
  const key = fullNameKey(p.payer_name);
  return aliases.filter((a) => (iban && normIban(a.payer_iban) === iban) || (key && fullNameKey(a.payer_name) === key));
};

/**
 * "Priskirti": the payment goes to a student. With "Prisiminti šį mokėtoją" the payer (IBAN and full name)
 * is remembered, and their other unassigned payments are assigned too.
 */
export async function assignPayment(input: { id: string; studentId: string; remember: boolean }): Promise<BankActionResult> {
  if (!isId(input.id) || !isId(input.studentId)) return fail("Pasirink mokinį.");
  const { supabase, ownerId } = await session();
  const payment = await loadBankPayment(supabase, input.id);
  if (!payment) return fail("Mokėjimas nerastas.");

  const { error } = await supabase.from("payments").update({ student_id: input.studentId, hidden_at: null, hidden_reason: null }).eq("id", payment.id);
  if (error) {
    console.error("assignPayment:", error.message);
    return fail(SAVE_FAILED);
  }
  if (!input.remember) return done("Mokėjimas priskirtas");

  try {
    if (!(await rememberPayer(supabase, ownerId, payment, input.studentId))) {
      return done("Mokėjimas priskirtas · mokėtojo neprisiminiau – nėra IBAN ir pilno vardo");
    }
    const others = await assignOthers(supabase, ownerId);
    return done(others ? `Mokėjimas priskirtas · dar ${others} to paties mokėtojo` : "Mokėjimas priskirtas · mokėtojas prisimintas");
  } catch (e) {
    console.error("assignPayment (remember):", e instanceof Error ? e.message : e);
    return done("Mokėjimas priskirtas, bet mokėtojo prisiminti nepavyko");
  }
}

/** Saves the payer (IBAN and full name, whichever the bank gave). false = nothing to remember them by. */
async function rememberPayer(supabase: Supabase, ownerId: string, p: { payer_name: string | null; payer_iban: string | null }, studentId: string) {
  const alias = aliasToRemember(await loadAliases(supabase, ownerId), p, studentId);
  if (!alias) return false;
  const { error } = alias.updateId
    ? await supabase.from("payer_aliases").update(alias.values).eq("id", alias.updateId)
    : await supabase.from("payer_aliases").insert(alias.values);
  if (error) throw new Error(`payer_aliases: ${error.message}`);
  return true;
}

/** Unassigned (not hidden) bank payments whose payer is now known → their student. Returns how many. */
async function assignOthers(supabase: Supabase, ownerId: string) {
  const [aliases, { data, error }] = await Promise.all([
    loadAliases(supabase, ownerId),
    supabase.from("payments").select("id, payer_name, payer_iban").is("student_id", null).is("hidden_at", null).neq("source", "manual"),
  ]);
  if (error) throw new Error(`payments: ${error.message}`);
  const byStudent = new Map<string, string[]>();
  for (const p of data) {
    const match = matchStudent(aliases, p);
    if (match) byStudent.set(match.studentId, [...(byStudent.get(match.studentId) ?? []), p.id]);
  }
  let count = 0;
  for (const [studentId, ids] of byStudent) {
    const { error: e } = await supabase.from("payments").update({ student_id: studentId }).in("id", ids).is("student_id", null);
    if (!e) count += ids.length;
  }
  return count;
}

async function forgetPayer(supabase: Supabase, ownerId: string, p: { payer_name: string | null; payer_iban: string | null }) {
  const ids = aliasesOf(await loadAliases(supabase, ownerId), p).map((a) => a.id);
  if (ids.length) await supabase.from("payer_aliases").delete().in("id", ids);
}

/** "Atsieti": back to "Nepriskirti mokėjimai". `forget` also forgets the payer, so it isn't auto-assigned again. */
export async function unassignPayment(input: { id: string; forget: boolean }): Promise<BankActionResult> {
  if (!isId(input.id)) return fail("Mokėjimas nerastas.");
  const { supabase, ownerId } = await session();
  const payment = await loadBankPayment(supabase, input.id);
  if (!payment) return fail("Mokėjimas nerastas.");
  const { error } = await supabase.from("payments").update({ student_id: null }).eq("id", payment.id);
  if (error) {
    console.error("unassignPayment:", error.message);
    return fail(SAVE_FAILED);
  }
  if (input.forget) await forgetPayer(supabase, ownerId, payment);
  return done("Mokėjimas atsietas – jis tarp nepriskirtų");
}

/** "Paslėpti": not a student's payment. Never deleted – it can be brought back from "Paslėpti". */
export async function hidePayment(input: { id: string; reason: string; forget: boolean }): Promise<BankActionResult> {
  if (!isId(input.id)) return fail("Mokėjimas nerastas.");
  const reason = input.reason.trim().slice(0, 200);
  if (!reason) return fail("Parašyk priežastį.");
  const { supabase, ownerId } = await session();
  const payment = await loadBankPayment(supabase, input.id);
  if (!payment) return fail("Mokėjimas nerastas.");
  const { error } = await supabase
    .from("payments")
    .update({ student_id: null, hidden_at: new Date().toISOString(), hidden_reason: reason })
    .eq("id", payment.id);
  if (error) {
    console.error("hidePayment:", error.message);
    return fail(SAVE_FAILED);
  }
  if (input.forget) await forgetPayer(supabase, ownerId, payment);
  return done("Mokėjimas paslėptas");
}

export async function unhidePayment(id: string): Promise<BankActionResult> {
  if (!isId(id)) return fail("Mokėjimas nerastas.");
  const { supabase } = await session();
  const payment = await loadBankPayment(supabase, id);
  if (!payment) return fail("Mokėjimas nerastas.");
  const { error } = await supabase.from("payments").update({ hidden_at: null, hidden_reason: null }).eq("id", payment.id);
  if (error) {
    console.error("unhidePayment:", error.message);
    return fail(SAVE_FAILED);
  }
  return done("Mokėjimas grąžintas į nepriskirtus");
}

function done(message: string): BankActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

/* ---------------- Nustatymai → Bankas ---------------- */

/** "Sinchronizuoti dabar": attended (PSU headers), doesn't wait for the 2-hour app-open limit; never while rate-limited. */
export async function syncBankNow(): Promise<BankInfo> {
  await session();
  const info = await syncBank({ mode: "manual", psu: await requestPsuHeaders() });
  revalidatePath("/", "layout");
  return info;
}

/** "Atjungti": closes the consent at the bank and forgets the session. Imported payments stay. */
export async function disconnectBank() {
  const { ownerId } = await session();
  const admin = createAdminClient();
  const { data } = await admin.from("bank_connection").select("session_id").eq("owner_id", ownerId).maybeSingle();
  if (data?.session_id) await deleteSession(data.session_id);
  const { error } = await admin
    .from("bank_connection")
    .update({ session_id: null, accounts: [], valid_until: null, last_error: null, sync_lock_until: null })
    .eq("owner_id", ownerId);
  if (error) throw new Error("Nepavyko atjungti.");
  revalidatePath("/", "layout");
}

/* ---------------- Mokėjimai → "Įkelti išrašą" ---------------- */

const MAX_STATEMENT_BYTES = 900_000; // Server Actions accept up to 1 MB – months of a personal account fit easily

export type StatementRow = {
  date: string;
  amount: number;
  payerName: string | null;
  remittance: string | null;
  studentName: string | null; // known payer → this student
  duplicate: boolean; // already in Chalk (same bank id, or the same payment from the bank sync)
};

export type StatementResult =
  | { ok: true; rows: StatementRow[]; skipped: { outgoing: number; early: number; other: number }; imported?: number }
  | { ok: false; message: string };

/**
 * Reads an uploaded statement. `apply` = false: only shows what would be imported (nothing is written).
 * `apply` = true: imports the new rows (same file sent again) – inserts only, duplicates are skipped.
 */
export async function importStatement(form: FormData, apply: boolean): Promise<StatementResult> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Pasirink išrašo failą." };
  if (file.size > MAX_STATEMENT_BYTES) return { ok: false, message: "Failas per didelis – pasirink trumpesnį laikotarpį." };
  if (/\.xlsx?$/i.test(file.name)) return { ok: false, message: "Excel failo Chalk neskaito – atidaryk jį Excel'yje ir išsaugok kaip „CSV UTF-8“." };
  if (!/\.(csv|txt)$/i.test(file.name)) return { ok: false, message: "Įkelk išrašą CSV formatu (.csv)." };

  const { supabase, ownerId } = await session();
  let parsed;
  try {
    parsed = parseStatement(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    return { ok: false, message: e instanceof StatementError ? e.message : "Nepavyko perskaityti failo." };
  }

  try {
    const { planned, duplicates } = await planImport(supabase, ownerId, parsed.candidates, "csv");
    const imported = apply ? await insertPlanned(supabase, ownerId, planned, "csv") : undefined;

    const { data: students } = await supabase.from("students").select("id, first_name, last_name");
    const names = displayNames((students ?? []).map((x) => ({ id: x.id, firstName: x.first_name, lastName: x.last_name })));
    const row = (c: (typeof planned)[number] | (typeof duplicates)[number], duplicate: boolean): StatementRow => ({
      date: c.booked_on,
      amount: c.amount,
      payerName: c.payer_name,
      remittance: c.remittance,
      studentName: "student_id" in c && c.student_id ? (names.get(c.student_id) ?? null) : null,
      duplicate,
    });
    const rows = [...planned.map((c) => row(c, false)), ...duplicates.map((c) => row(c, true))].sort((a, b) => b.date.localeCompare(a.date));
    if (apply) revalidatePath("/", "layout");
    return { ok: true, rows, skipped: parsed.skipped, imported };
  } catch (e) {
    console.error("importStatement:", e instanceof Error ? e.message : e);
    return { ok: false, message: "Nepavyko importuoti. Pabandyk dar kartą." };
  }
}
