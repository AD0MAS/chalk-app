// Shared by the app (server + client) and scripts/bank-preview.mts – so only relative imports here.
// Bank payments: a bank via Enable Banking, or an uploaded statement (docs/SPEC.md §1 Payments).

/** Only money received on or after this day is imported – earlier payments are in the opening balances. */
export const BANK_IMPORT_FROM = "2026-10-21";

/** Consent expiry warning (Nustatymai, navbar dot). */
export const EXPIRY_WARNING_DAYS = 14;

/**
 * off = not connected · review = connected, first import not approved yet · ok · warning = consent ends soon ·
 * limited = the bank asked to wait (429) – a calm pause, not an error · error = last sync failed ·
 * expired = consent ended ("Pratęsti").
 */
export type BankState = "off" | "review" | "ok" | "warning" | "limited" | "error" | "expired";

export type BankInfo = {
  state: BankState;
  message: string | null;
  lastSyncAt: string | null;
  validUntil: string | null;
  daysLeft: number | null; // whole days until the consent ends
  retryAfter: string | null; // rate-limited: no bank request before this time
  budgetLeft: number; // background (unattended) bank requests left in the rolling 24 h (lib/bank/budget.ts)
  budgetFreesAt: string | null; // budget used up: when the next one frees
  imported?: number; // set by a sync that just ran: how many new payments
  skipped?: "rate-limited" | "throttled" | "not-attended" | "no-budget"; // set by a sync that did not call the bank
};

export const BANK_OFF: BankInfo = {
  state: "off",
  message: null,
  lastSyncAt: null,
  validUntil: null,
  daysLeft: null,
  retryAfter: null,
  budgetLeft: 0,
  budgetFreesAt: null,
};

/** Ready-made reasons for hiding a bank payment that is not a student's. */
export const HIDE_REASONS = ["Ne mokinio mokėjimas", "Grąžinimas / pervedimas sau", "Dublikatas"];

/* ---------------- payer matching ---------------- */

/** "LT12 3456 …" → "LT123456…" */
export const normIban = (iban: string | null | undefined) => (iban ?? "").replace(/\s/g, "").toUpperCase() || null;

/**
 * Payer names arrive as "JONAS PAVARDENIS", "Pavardenis Jonas", "Jonas Pavardenis," …
 * Lowercase, no diacritics, words sorted – so all of these are the same payer.
 */
export function payerKey(name: string | null | undefined) {
  const words = (name ?? "")
    .toLocaleLowerCase("lt")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .sort();
  return words.length ? words.join(" ") : null;
}

/**
 * The payer key used to assign payments automatically – only for a full name: at least two words, none of them
 * an initial ("R. Pavardenienė" or "R P" → null). Two different people often share initials, never a full name.
 */
export function fullNameKey(name: string | null | undefined) {
  const key = payerKey(name);
  const words = key?.split(" ") ?? [];
  return words.length >= 2 && words.every((w) => w.length >= 2) ? key : null;
}

/**
 * The same transfer seen in two places (bank sync and an uploaded statement) has different ids,
 * so across sources we compare date + amount + payer instead.
 */
export const fingerprint = (p: { booked_on: string; amount: number; payer_name: string | null }) =>
  `${p.booked_on}|${p.amount.toFixed(2)}|${payerKey(p.payer_name) ?? ""}`;

/* ---------------- masking (previews in chat / logs) ---------------- */

/** "Jonas Pavardenis" → "J*** P***" */
export const maskName = (name: string | null | undefined) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w[0]}***`)
    .join(" ") || "–";

/** "LT123456789012345678" → "LT** … 5678" */
export const maskIban = (iban: string | null | undefined) => {
  const v = normIban(iban);
  return v ? `${v.slice(0, 2)}** … ${v.slice(-4)}` : "–";
};
