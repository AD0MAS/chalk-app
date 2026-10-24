import "server-only";
import { headers } from "next/headers";
import { connection } from "next/server";
import { addDays, formatDateLong, todayVilnius, vilniusParts } from "@/lib/lessons/time";
import { createAdminClient, type AdminClient } from "@/lib/supabase/admin";
import { budgetFreesAt, budgetLeft, decideSync, isRateLimited, retryAfterFrom, spendCall, type BankCall, type SyncMode } from "./budget";
import { BANK_IMPORT_FROM, BANK_OFF, EXPIRY_WARNING_DAYS, type BankInfo } from "./constants";
import { BankApiError, isBankConfigured, listTransactions, type BankAccount, type BeforeBankCall, type PsuHeaders } from "./enable-banking";
import { fromTransaction, insertPlanned, planImport, type Candidate } from "./import";

// Bank → Chalk payments (docs/SPEC.md §1 Payments, Phase 3). How often the bank may be asked:
// lib/bank/budget.ts (PSD2 – at most 4 background requests per 24 h). Runs:
//   * when Chalk is opened (navbar → POST /api/bank/sync) – attended (PSU headers), at most every 2 h;
//   * "Sinchronizuoti dabar" in Nustatymai and right after "Pratęsti" – attended;
//   * the daily cron (/api/cron/sync) – background, within the budget.
// The every-minute navbar poll (/api/sync) is Google only and never reaches this file.
// Nothing here blocks the UI or throws: a failure is stored in bank_connection.last_error, a 429 in retry_after.
// Only inserts – a sync never changes or deletes a payment.

const LOCK_MS = 2 * 60_000;
const OVERLAP_DAYS = 7; // a transfer may be booked a few days late – re-read a week, dedup skips the known ones

export type BankConnection = {
  owner_id: string;
  session_id: string;
  accounts: BankAccount[];
  valid_until: string | null;
  connected_at: string | null;
  import_approved_at: string | null;
  last_sync_at: string | null;
  last_attempt_at: string | null;
  last_imported: number | null;
  last_error: string | null;
  bank_calls: BankCall[];
  retry_after: string | null;
};

/** Chalk has one user, so there is at most one connection. */
export async function loadBankConnection(supabase: AdminClient): Promise<BankConnection | null> {
  const { data, error } = await supabase
    .from("bank_connection")
    .select("owner_id, session_id, accounts, valid_until, connected_at, import_approved_at, last_sync_at, last_attempt_at, last_imported, last_error, bank_calls, retry_after")
    .not("session_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`bank_connection: ${error.message}`);
  return data as BankConnection | null;
}

/** The accounts Chalk reads (EUR only). */
const syncedAccounts = (accounts: BankAccount[]) => accounts.filter((a) => !a.currency || a.currency === "EUR");

/** "~14:30" today, "rytoj ~04:30" tomorrow (Vilnius time). */
export function aroundTime(iso: string, now = Date.now()) {
  const { date, time } = vilniusParts(iso);
  const today = todayVilnius(new Date(now));
  if (date === today) return `~${time}`;
  return date === addDays(today, 1) ? `rytoj ~${time}` : `${formatDateLong(date)} ~${time}`;
}

export function bankInfoOf(conn: BankConnection | null, now = Date.now()): BankInfo {
  if (!isBankConfigured() || !conn) return BANK_OFF;
  const end = conn.valid_until ? Date.parse(conn.valid_until) : null;
  const daysLeft = end === null ? null : Math.max(0, Math.floor((end - now) / 86_400_000));
  const accounts = syncedAccounts(conn.accounts).map((a) => a.uid);
  const limited = isRateLimited(conn.retry_after, now);
  const limitedMessage = limited ? `Bankas laikinai riboja užklausas – kitas bandymas ${aroundTime(conn.retry_after!, now)}` : null;
  const base = {
    message: conn.last_error ?? limitedMessage,
    lastSyncAt: conn.last_sync_at,
    validUntil: conn.valid_until,
    daysLeft,
    retryAfter: limited ? conn.retry_after : null,
    budgetLeft: budgetLeft(conn.bank_calls, accounts, now),
    budgetFreesAt: budgetFreesAt(conn.bank_calls, accounts, now),
  };
  if (end !== null && end <= now) return { ...base, state: "expired", message: "Banko sutikimas baigėsi – spausk „Pratęsti“." };
  if (!conn.import_approved_at) return { ...base, state: "review" };
  if (conn.last_error) return { ...base, state: "error" };
  if (daysLeft !== null && daysLeft <= EXPIRY_WARNING_DAYS) return { ...base, state: "warning" };
  if (limited) return { ...base, state: "limited" };
  return { ...base, state: "ok" };
}

export async function getBankInfo(supabase = createAdminClient()) {
  await connection(); // request-time: the consent countdown uses the current time (Next 16)
  if (!isBankConfigured()) return BANK_OFF;
  return bankInfoOf(await loadBankConnection(supabase));
}

/**
 * "Adomas is here": his IP and browser, so the bank does not count the request against the
 * background limit. Local addresses (dev) are not sent – the bank would reject them; without headers
 * the request is a background one (budget).
 */
export async function requestPsuHeaders(): Promise<PsuHeaders | undefined> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
  if (!ip || /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:127\.|fc|fd|fe80)/i.test(ip)) return undefined;
  const psu: PsuHeaders = { "Psu-Ip-Address": ip };
  const ua = h.get("user-agent");
  if (ua) psu["Psu-User-Agent"] = ua;
  const lang = h.get("accept-language");
  if (lang) psu["Psu-Accept-language"] = lang;
  return psu;
}

/** Thrown by the per-call check when the background budget runs out mid-sync (more pages than expected). */
class BudgetExhausted extends Error {}

/**
 * Fetches new incoming payments and imports them. `psu` = Adomas's headers (attended); without them the
 * request is a background one and must fit the budget. Returns the status, with `imported` = how many are new,
 * or `skipped` = why the bank was not asked.
 */
export async function syncBank({ mode, psu }: { mode: SyncMode; psu?: PsuHeaders }): Promise<BankInfo> {
  if (!isBankConfigured()) return BANK_OFF;
  const supabase = createAdminClient();
  const conn = await loadBankConnection(supabase);
  const info = bankInfoOf(conn);
  // Not connected, consent over, or the first import still waits for Adomas's "importuok".
  if (!conn || info.state === "expired" || info.state === "review") return info;

  const attended = !!psu;
  const decision = decideSync({
    mode,
    attended,
    accounts: syncedAccounts(conn.accounts).map((a) => a.uid),
    calls: conn.bank_calls,
    retryAfter: conn.retry_after,
    lastAttemptAt: conn.last_attempt_at,
  });
  if (!decision.run) return { ...info, skipped: decision.reason };
  if (!(await claimLock(supabase, conn.owner_id))) return info;

  // Every bank request is recorded before it is sent – if saving fails, the request is not made.
  let calls = conn.bank_calls;
  const before: BeforeBankCall = async (account) => {
    const next = spendCall(calls, account, attended);
    if (!next) throw new BudgetExhausted("Background budget used up");
    const { error } = await supabase.from("bank_connection").update({ bank_calls: next }).eq("owner_id", conn.owner_id);
    if (error) throw new Error(`bank_connection: ${error.message}`);
    calls = next;
  };

  let ok = false;
  let lastError: string | null = null;
  let retryAfter: string | null = null;
  let imported = 0;
  try {
    const from = conn.last_sync_at ? addDays(vilniusParts(conn.last_sync_at).date, -OVERLAP_DAYS) : BANK_IMPORT_FROM;
    const candidates = await fetchCandidates(conn.accounts, from, before, psu);
    const { planned } = await planImport(supabase, conn.owner_id, candidates, "bank");
    imported = await insertPlanned(supabase, conn.owner_id, planned, "bank");
    ok = true;
  } catch (e) {
    if (e instanceof BankApiError && e.rateLimited) {
      // A pause, not an error: no bank request until then (Nustatymai shows when).
      retryAfter = retryAfterFrom(e.retryAfter);
      console.warn(`Bank sync (${mode}, ${attended ? "attended" : "background"}): rate-limited until ${retryAfter}`);
    } else if (e instanceof BudgetExhausted) {
      console.warn(`Bank sync (${mode}): background budget used up – next time`);
    } else {
      console.error("Bank sync failed:", e instanceof Error ? e.message : e);
      lastError = errorMessage(e);
    }
  } finally {
    const now = new Date().toISOString();
    await supabase
      .from("bank_connection")
      .update({
        sync_lock_until: null,
        last_attempt_at: now,
        last_error: lastError,
        retry_after: retryAfter,
        ...(ok ? { last_sync_at: now, last_imported: imported } : {}),
      })
      .eq("owner_id", conn.owner_id);
  }
  return { ...bankInfoOf(await loadBankConnection(supabase)), imported };
}

/** Every account of the session (restricted mode: only the accounts Adomas linked). */
export async function fetchCandidates(accounts: BankAccount[], from: string, before: BeforeBankCall, psu?: PsuHeaders) {
  const out: Candidate[] = [];
  for (const account of syncedAccounts(accounts)) {
    for (const tx of await listTransactions(account.uid, from, before, psu)) {
      const c = fromTransaction(tx);
      if (c) out.push(c);
    }
  }
  return out;
}

function errorMessage(e: unknown) {
  if (e instanceof BankApiError && e.sessionGone) return "Banko sutikimas nebegalioja – spausk „Pratęsti“ ir prisijunk prie banko iš naujo.";
  return "Nepavyko gauti duomenų iš banko. Bandysiu vėliau.";
}

/** Atomic "only one sync at a time": succeeds only if nobody holds a fresh lock. */
async function claimLock(supabase: AdminClient, ownerId: string) {
  const now = new Date();
  const { data } = await supabase
    .from("bank_connection")
    .update({ sync_lock_until: new Date(now.getTime() + LOCK_MS).toISOString() })
    .eq("owner_id", ownerId)
    .or(`sync_lock_until.is.null,sync_lock_until.lt.${now.toISOString()}`)
    .select("owner_id");
  return !!data?.length;
}
