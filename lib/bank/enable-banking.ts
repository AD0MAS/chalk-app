import { createPrivateKey, randomUUID, sign, type KeyObject } from "node:crypto";
import { BANK_IMPORT_FROM } from "./constants.ts";

// Enable Banking API (enablebanking.com/docs/api/reference) – plain fetch, no SDK.
// Server only: uses node:crypto and the private key from the environment (also used by scripts/bank-preview.mts,
// so only relative imports). The key never leaves the server and is never logged.
//
// Every request carries a JWT signed with the app's private key (RS256, kid = application id, max 24 h).

const API = "https://api.enablebanking.com";

export const BANK_STATE_COOKIE = "chalk_bank_state";

/** The bank to connect, exactly as Enable Banking lists it (.env: BANK_ASPSP_NAME, BANK_ASPSP_COUNTRY). */
const bankAspsp = () => ({ name: process.env.BANK_ASPSP_NAME ?? "", country: process.env.BANK_ASPSP_COUNTRY ?? "" });

export const isBankConfigured = () =>
  !!process.env.ENABLE_BANKING_APP_ID && !!process.env.ENABLE_BANKING_PRIVATE_KEY && !!process.env.BANK_ASPSP_NAME && !!process.env.BANK_ASPSP_COUNTRY;

/**
 * The key may be stored as a real multi-line PEM (Vercel, quoted in .env.local), with "\n" escapes on one line,
 * or base64 of the whole .pem file.
 */
let key: KeyObject | null = null;
function privateKey() {
  if (key) return key;
  const raw = (process.env.ENABLE_BANKING_PRIVATE_KEY ?? "").trim().replace(/^"|"$/g, "");
  const pem = raw.includes("BEGIN") ? raw.replace(/\\n/g, "\n") : Buffer.from(raw, "base64").toString("utf8");
  key = createPrivateKey(pem);
  return key;
}

const b64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "RS256", kid: process.env.ENABLE_BANKING_APP_ID }));
  const body = b64url(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: now, exp: now + 3600 }));
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${body}`), privateKey());
  return `${header}.${body}.${b64url(signature)}`;
}

export class BankApiError extends Error {
  status: number;
  code: string | null;
  retryAfter: string | null; // the Retry-After header of a 429, as sent
  constructor(status: number, code: string | null, message: string, retryAfter: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
  /** The bank (or Enable Banking) limits requests – wait, don't retry. */
  get rateLimited() {
    return this.status === 429 || this.code === "ASPSP_RATE_LIMIT_EXCEEDED";
  }
  /** The consent is gone (expired, revoked, closed) – Adomas has to connect again. */
  get sessionGone() {
    return this.status === 401 || this.status === 403 || /SESSION|EXPIRED|REVOKED|CLOSED|ACCESS_DENIED/.test(this.code ?? "");
  }
}

async function call<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(API + path, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${jwt()}`, "Content-Type": "application/json", ...init.headers },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    // Only the code and message – never the request (it may contain the session id).
    throw new BankApiError(
      res.status,
      typeof json.error === "string" ? json.error : null,
      `Enable Banking ${res.status}: ${json.error ?? ""} ${json.message ?? ""}`.trim(),
      res.headers.get("retry-after")
    );
  }
  return json as T;
}

/* ---------------- connecting ---------------- */

type Aspsp = { name: string; country: string; maximum_consent_validity?: number; psu_types?: string[] };

/** The configured bank as Enable Banking lists it (name + how long a consent may last). */
export async function findBank() {
  const { name, country } = bankAspsp();
  const { aspsps } = await call<{ aspsps: Aspsp[] }>(`/aspsps?country=${encodeURIComponent(country)}&psu_type=personal`);
  const aspsp = aspsps.find((a) => a.name.toLowerCase() === name.toLowerCase());
  if (!aspsp) throw new Error(`Enable Banking sąraše nėra banko „${name}“ (${country}).`);
  return aspsp;
}

/** Starts the bank login: returns the URL to send Adomas to. */
export async function startAuth(redirectUrl: string, state: string) {
  const aspsp = await findBank();
  // As long as the bank allows (Enable Banking rejects longer), capped at 180 days, minus a minute of margin.
  const seconds = Math.min(aspsp.maximum_consent_validity ?? 90 * 86400, 180 * 86400) - 60;
  const { url } = await call<{ url: string }>("/auth", {
    method: "POST",
    body: {
      access: { valid_until: new Date(Date.now() + seconds * 1000).toISOString() },
      aspsp: { name: aspsp.name, country: aspsp.country },
      state,
      redirect_url: redirectUrl,
      psu_type: "personal",
      language: "lt",
    },
  });
  return url;
}

export type BankAccount = { uid: string; iban: string | null; name: string | null; currency: string | null };

type SessionAccount = { uid?: string; account_id?: { iban?: string }; name?: string; currency?: string };

/** After the bank redirects back with ?code=… – creates the session. */
export async function createSession(code: string) {
  const s = await call<{ session_id: string; accounts?: SessionAccount[]; aspsp?: { name?: string }; access?: { valid_until?: string } }>("/sessions", {
    method: "POST",
    body: { code },
  });
  const accounts: BankAccount[] = (s.accounts ?? [])
    .filter((a) => a.uid)
    .map((a) => ({ uid: a.uid!, iban: a.account_id?.iban ?? null, name: a.name ?? null, currency: a.currency ?? null }));
  return { sessionId: s.session_id, accounts, aspspName: s.aspsp?.name ?? bankAspsp().name, validUntil: s.access?.valid_until ?? null };
}

/** "Atjungti" / "Pratęsti": closes the old consent at the bank too. Best effort. */
export async function deleteSession(sessionId: string) {
  await call(`/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }).catch(() => undefined);
}

/* ---------------- transactions ---------------- */

export type Transaction = {
  entry_reference?: string | null;
  transaction_id?: string | null;
  transaction_amount: { amount: string; currency: string };
  credit_debit_indicator: "CRDT" | "DBIT";
  status: string;
  booking_date?: string | null;
  value_date?: string | null;
  transaction_date?: string | null;
  debtor?: { name?: string | null } | null;
  debtor_account?: { iban?: string | null } | null;
  remittance_information?: string[] | null;
};

/**
 * PSU headers say "Adomas is online right now" (Enable Banking FAQ: with them the bank's background limit –
 * 4 requests a day per account – generally does not apply). Chalk sends IP, browser and language. Background requests (cron) must send none.
 */
export type PsuHeaders = Record<string, string>;

/**
 * Called before every request to the bank (each page) – lib/bank/budget.ts counts them. Throwing stops the sync.
 * Every account-data request MUST go through it.
 */
export type BeforeBankCall = (accountUid: string) => Promise<void>;

/** All booked transactions of one account from `from` (YYYY-MM-DD) until today, every page. */
export async function listTransactions(accountUid: string, from: string, before: BeforeBankCall, psu?: PsuHeaders) {
  const out: Transaction[] = [];
  let continuation: string | null = null;
  for (let page = 0; page < 50; page++) {
    const q = new URLSearchParams({ date_from: from < BANK_IMPORT_FROM ? BANK_IMPORT_FROM : from });
    if (continuation) q.set("continuation_key", continuation);
    await before(accountUid);
    const res: { transactions?: Transaction[]; continuation_key?: string | null } = await call(
      `/accounts/${encodeURIComponent(accountUid)}/transactions?${q}`,
      { headers: psu }
    );
    out.push(...(res.transactions ?? []));
    continuation = res.continuation_key ?? null;
    if (!continuation) break;
  }
  return out;
}

export const newState = () => randomUUID();
