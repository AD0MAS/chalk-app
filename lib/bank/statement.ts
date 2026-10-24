import { BANK_IMPORT_FROM, normIban } from "./constants.ts";
import { fallbackId, type Candidate } from "./import.ts";

// Mokėjimai → "Įkelti išrašą": a bank statement CSV → the same candidates as the bank sync,
// so the same dedup and matching rules apply (lib/bank/import.ts).
//
// Columns are found by their header text (Lithuanian or English), not by position, so a slightly different
// export still works. Only incoming EUR payments in the window (default: on or after 2026-10-21) are taken; the rest is counted
// as skipped. Server only; relative imports (shared with scripts).

export type ParsedStatement = {
  candidates: Candidate[];
  skipped: { outgoing: number; early: number; other: number };
};

export class StatementError extends Error {}

const fold = (s: string) =>
  s.toLocaleLowerCase("lt").normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();

/** UTF-8 (with or without BOM); older Baltic exports are Windows-1257. */
function decode(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1257").decode(bytes);
  }
}

/** RFC 4180-ish CSV: quoted fields, "" inside quotes, any of ; , or tab as the separator. */
function parseCsv(text: string): string[][] {
  const sample = text.split(/\r?\n/).slice(0, 20).join("\n");
  const sep = [";", "\t", ","].map((c) => ({ c, n: sample.split(c).length })).sort((a, b) => b.n - a.n)[0].c;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

/* ---------------- columns ---------------- */

// First matching header wins; each list is in order of preference. Matched on folded text (no diacritics).
// Example bank statement CSV: Sąskaita · Data · Tipas · Gavėjas / mokėtojas · Paskirtis ·
// Mokėjimo nr. · Banko pažyma · Deb. suma · Kred. suma – "Sąskaita" is Adomas's own account, "Banko pažyma" the bank's id.
const COLUMNS = {
  date: ["operacijos data", "irasymo data", "iraso data", "uzskaitymo data", "booking date", "transaction date", "data", "date"],
  amount: ["suma eur", "suma", "amount", "kiekis"],
  credit: ["kred. suma", "kreditas", "iplaukos", "gauta", "credit"],
  debit: ["deb. suma", "debetas", "islaidos", "isleista", "debit"],
  direction: ["d/k", "k/d", "d / k", "c/d", "debetas/kreditas", "debit/credit", "dr/cr", "tipas", "type"],
  payer: ["moketojas", "moketojo pavadinimas", "moketojo vardas", "gavejas/moketojas", "gavejas / moketojas", "moketojas/gavejas", "siuntejas", "korespondentas", "partneris", "kontrahentas", "counterparty", "payer", "beneficiary", "gavejas", "pavadinimas", "name"],
  iban: ["moketojo saskaita", "korespondento saskaita", "partnerio saskaita", "kontrahento saskaita", "counterparty account", "payer account", "iban", "saskaita", "account"],
  remittance: ["mokejimo paskirtis", "paskirtis", "detales", "details", "paaiskinimai", "aprasymas", "description", "informacija", "purpose", "pastabos"],
  reference: ["banko pazyma", "iraso id", "operacijos id", "transakcijos id", "operacijos numeris", "archyvo kodas", "archyvinis", "unikalus", "transaction id", "reference", "nuorodos nr", "iraso nr"],
  currency: ["valiuta", "currency"],
} as const;

type Column = keyof typeof COLUMNS;

function findColumns(header: string[]) {
  const folded = header.map(fold);
  const used = new Set<number>();
  const found: Partial<Record<Column, number>> = {};
  // Specific columns first, so e.g. "Mokėtojo sąskaita" is taken as the IBAN, not as the payer name.
  for (const col of ["reference", "iban", "remittance", "credit", "debit", "direction", "currency", "date", "amount", "payer"] as Column[]) {
    for (const word of COLUMNS[col]) {
      // The payer's document number is not unique – never use it as the id.
      const i = folded.findIndex((h, idx) => !used.has(idx) && h.includes(word) && !(col === "reference" && /dok/.test(h)));
      if (i >= 0) {
        found[col] = i;
        used.add(i);
        break;
      }
    }
  }
  return found;
}

/* ---------------- values ---------------- */

/** "2026-10-21", "2026.10.21", "21.10.2026", "21/10/2026" (+ optional time) → "2026-10-21". */
function parseDate(v: string) {
  let m = v.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = v.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

/** "1 234,56", "1.234,56", "1,234.56", "-25.00 €", "+25" → number; NaN if not a number. */
function parseMoney(v: string) {
  let s = v.replace(/[\s €]|EUR/gi, "").replace("−", "-");
  if (!s) return NaN;
  const comma = s.lastIndexOf(",");
  const dot = s.lastIndexOf(".");
  if (comma > dot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  return /^[-+]?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

/**
 * The statement's "Gavėjas / mokėtojas" is "VARDAS PAVARDĖ <BIC> <account>…" (name, then the payer's bank BIC and account).
 * Keep only the name: everything before the first word with a digit (BIC codes and account numbers have digits,
 * names never do) – so the name matches bank-sync payments and payer_aliases.
 */
function payerName(value: string) {
  const words = value.split(/\s+/).filter(Boolean);
  const cut = words.findIndex((w) => /\d/.test(w));
  return (cut < 0 ? words : words.slice(0, cut)).join(" ") || null;
}

function isCredit(direction: string) {
  const d = fold(direction);
  if (/^(k|c|cr|crdt|kreditas|credit|iplauka|gauta)$/.test(d) || /^(ieinantis|gautas)/.test(d)) return true;
  if (/^(d|dr|dbit|debetas|debit|islaida|isleista)$/.test(d) || /^(iseinantis|pirkinys)/.test(d)) return false;
  return null;
}

/* ---------------- the statement ---------------- */

/** `from` / `to` (inclusive) default to the bank import window: 2026-10-21 onwards. Earlier rows were imported once, separately. */
export function parseStatement(bytes: Uint8Array, { from = BANK_IMPORT_FROM, to = "9999-12-31" } = {}): ParsedStatement {
  const rows = parseCsv(decode(bytes));
  // The header is the first row (of the first 30) that names both a date and an amount column.
  const headerAt = rows.slice(0, 30).findIndex((r) => {
    const c = findColumns(r);
    return c.date !== undefined && (c.amount !== undefined || c.credit !== undefined);
  });
  if (headerAt < 0) throw new StatementError("Neatpažinau išrašo: nerasta stulpelių „Data“ ir „Suma“. Įkelk banko išrašą CSV formatu.");
  const col = findColumns(rows[headerAt]);
  const body = rows.slice(headerAt + 1);

  // A column with the same IBAN on every row is Adomas's own account, not the payer's.
  if (col.iban !== undefined) {
    const values = new Set(body.map((r) => normIban(r[col.iban!])).filter(Boolean));
    if (values.size <= 1 && body.length > 1) delete col.iban;
  }

  const get = (r: string[], c: Column) => (col[c] === undefined ? "" : (r[col[c]!] ?? ""));
  const out: ParsedStatement = { candidates: [], skipped: { outgoing: 0, early: 0, other: 0 } };

  for (const r of body) {
    const date = parseDate(get(r, "date"));
    if (!date) {
      out.skipped.other++; // totals, empty lines, balance rows
      continue;
    }
    let amount: number;
    if (col.credit !== undefined) {
      amount = parseMoney(get(r, "credit"));
      if (!(amount > 0)) {
        out.skipped.outgoing++;
        continue;
      }
    } else {
      amount = parseMoney(get(r, "amount"));
      const credit = col.direction !== undefined ? isCredit(get(r, "direction")) : amount > 0;
      if (credit === false || (credit === null && !(amount > 0))) {
        out.skipped.outgoing++;
        continue;
      }
      amount = Math.abs(amount);
    }
    const currency = get(r, "currency").toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || (currency && currency !== "EUR")) {
      out.skipped.other++;
      continue;
    }
    if (date < from || date > to) {
      out.skipped.early++;
      continue;
    }
    const base = {
      booked_on: date,
      amount: Math.round(amount * 100) / 100,
      payer_name: payerName(get(r, "payer")),
      payer_iban: normIban(get(r, "iban")),
      remittance: get(r, "remittance").replace(/\s+/g, " ") || null,
    };
    const ref = get(r, "reference");
    out.candidates.push({ ...base, bank_transaction_id: ref ? `csv:${ref}` : fallbackId(base) });
  }
  return out;
}
