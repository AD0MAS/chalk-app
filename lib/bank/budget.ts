// Shared by the app (lib/bank/sync.ts) and scripts/bank-preview.mts – so only relative imports here.
//
// How often Chalk may ask the bank (PSD2, EBA RTS Art. 31(5)): without Adomas online the bank allows at most
// 4 account-information requests per 24 h per account. A request is "attended" only when it carries his PSU
// headers (IP + browser) – Enable Banking passes them on and the bank does not count it against that limit.
//
//   * unattended (daily cron, a sync from localhost) – at most UNATTENDED_LIMIT bank calls per rolling 24 h
//     per account; every call (each transactions page) is recorded in bank_connection.bank_calls;
//   * app open (attended) – at most once per APP_OPEN_SYNC_MS;
//   * after a 429 – no bank call at all until bank_connection.retry_after.
// Pure functions: tested in budget.test.ts.

export const UNATTENDED_LIMIT = 4;
export const BUDGET_WINDOW_MS = 24 * 60 * 60_000;

/** Opening Chalk syncs at most this often (the cron and "Sinchronizuoti dabar" don't wait for it). */
export const APP_OPEN_SYNC_MS = 2 * 60 * 60_000;

/** Enable Banking FAQ: after ASPSP_RATE_LIMIT_EXCEEDED "continue data fetching after 6 hours" (unless the bank says when). */
export const RATE_LIMIT_BACKOFF_MS = 6 * 60 * 60_000;

/** One request to the bank: when, which account, and whether Adomas was online (PSU headers sent). */
export type BankCall = { at: string; account: string; attended: boolean };

/** Only the last 24 h matter – older calls are dropped before saving. */
export function recentCalls(calls: BankCall[] | null | undefined, now = Date.now()): BankCall[] {
  return (calls ?? []).filter((c) => {
    const at = Date.parse(c.at);
    return Number.isFinite(at) && now - at < BUDGET_WINDOW_MS;
  });
}

/** Unattended calls still allowed for this account in the rolling 24 h window. */
export function budgetFor(calls: BankCall[] | null | undefined, account: string, now = Date.now()) {
  const used = recentCalls(calls, now).filter((c) => !c.attended && c.account === account).length;
  return Math.max(0, UNATTENDED_LIMIT - used);
}

/** The tightest account decides (Chalk normally has one). No accounts → the full budget. */
export function budgetLeft(calls: BankCall[] | null | undefined, accounts: string[], now = Date.now()) {
  return accounts.length ? Math.min(...accounts.map((a) => budgetFor(calls, a, now))) : UNATTENDED_LIMIT;
}

/** When the next unattended call frees up (the oldest one in the window turns 24 h old). null = budget left now. */
export function budgetFreesAt(calls: BankCall[] | null | undefined, accounts: string[], now = Date.now()): string | null {
  if (budgetLeft(calls, accounts, now) > 0) return null;
  const oldest = recentCalls(calls, now)
    .filter((c) => !c.attended && accounts.includes(c.account))
    .map((c) => Date.parse(c.at))
    .sort((a, b) => a - b);
  // The oldest call of the fullest account; with one account that is simply the oldest unattended call.
  return oldest.length ? new Date(oldest[0] + BUDGET_WINDOW_MS).toISOString() : null;
}

export const isRateLimited = (retryAfter: string | null | undefined, now = Date.now()) => !!retryAfter && Date.parse(retryAfter) > now;

/**
 * When to try again after a 429. The bank's Retry-After (seconds or an HTTP date) if it sent one,
 * otherwise 6 hours; never less than a minute, never more than a day.
 */
export function retryAfterFrom(header: string | null | undefined, now = Date.now()): string {
  let ms = RATE_LIMIT_BACKOFF_MS;
  const value = header?.trim();
  if (value) {
    if (/^\d+$/.test(value)) ms = Number(value) * 1000;
    else if (Number.isFinite(Date.parse(value))) ms = Date.parse(value) - now;
  }
  ms = Math.min(Math.max(ms, 60_000), BUDGET_WINDOW_MS);
  return new Date(now + ms).toISOString();
}

/** app-open = navbar on a page load · manual = "Sinchronizuoti dabar" / after "Pratęsti" · cron = daily, nobody online. */
export type SyncMode = "app-open" | "manual" | "cron";

export type SyncDecision =
  | { run: true }
  | { run: false; reason: "rate-limited" | "throttled" | "not-attended" | "no-budget" };

/**
 * May a sync call the bank now? `attended` = Adomas's PSU headers are available.
 * The budget check here is for the first call; every further page is checked again before it is sent.
 */
export function decideSync(input: {
  mode: SyncMode;
  attended: boolean;
  accounts: string[];
  calls: BankCall[] | null | undefined;
  retryAfter: string | null | undefined;
  lastAttemptAt: string | null | undefined;
  now?: number;
}): SyncDecision {
  const now = input.now ?? Date.now();
  if (isRateLimited(input.retryAfter, now)) return { run: false, reason: "rate-limited" };
  if (input.mode === "app-open") {
    // Without PSU headers (localhost) an app-open sync would be a background request – leave those to the cron.
    if (!input.attended) return { run: false, reason: "not-attended" };
    if (input.lastAttemptAt && now - Date.parse(input.lastAttemptAt) < APP_OPEN_SYNC_MS) return { run: false, reason: "throttled" };
  }
  if (!input.attended && budgetLeft(input.calls, input.accounts, now) < 1) return { run: false, reason: "no-budget" };
  return { run: true };
}

/**
 * Before each bank request: unattended → only within the budget. Returns the updated call list to save,
 * or null when the call must not be made.
 */
export function spendCall(calls: BankCall[] | null | undefined, account: string, attended: boolean, now = Date.now()): BankCall[] | null {
  if (!attended && budgetFor(calls, account, now) < 1) return null;
  return [...recentCalls(calls, now), { at: new Date(now).toISOString(), account, attended }];
}
