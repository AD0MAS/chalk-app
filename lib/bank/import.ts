import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types.ts";
import { BANK_IMPORT_FROM, fingerprint, fullNameKey, normIban } from "./constants.ts";
import type { Transaction } from "./enable-banking.ts";

// One import path for every bank payment – bank sync, uploaded statement and scripts/bank-preview.mts:
//   1. only money received (credit), booked, in EUR, on or after 2026-10-21;
//   2. dedup: the same bank id is never imported twice (also a unique index in the DB), and a payment
//      already imported from the other source (same date + amount + payer) is skipped;
//   3. matching: known payer (payer_aliases by IBAN, then by full name – never initials) → that student, otherwise unassigned.
// Server only (node:crypto); relative imports so the preview script can use it too.

type Client = SupabaseClient<Database>;
export type BankSource = "bank" | "csv";

export type Candidate = {
  bank_transaction_id: string;
  booked_on: string;
  amount: number;
  payer_name: string | null;
  payer_iban: string | null;
  remittance: string | null;
};

export type Planned = Candidate & { student_id: string | null; matched_by: "iban" | "name" | null };

const clean = (v: string | null | undefined) => v?.replace(/\s+/g, " ").trim() || null;

/** A stable id when the bank gives none: the same transfer always hashes to the same value. */
export const fallbackId = (c: Omit<Candidate, "bank_transaction_id">) =>
  "fp:" + createHash("sha256").update(`${fingerprint(c)}|${normIban(c.payer_iban) ?? ""}|${c.remittance ?? ""}`).digest("hex").slice(0, 32);

/** Enable Banking transaction → candidate payment, or null if it is not an incoming EUR payment we import. */
export function fromTransaction(tx: Transaction): Candidate | null {
  if (tx.credit_debit_indicator !== "CRDT" || tx.status !== "BOOK") return null;
  if (tx.transaction_amount?.currency !== "EUR") return null;
  const date = tx.booking_date ?? tx.value_date ?? tx.transaction_date;
  const amount = Math.round(Number(tx.transaction_amount.amount) * 100) / 100;
  if (!date || date < BANK_IMPORT_FROM || !(amount > 0)) return null;
  const base = {
    booked_on: date,
    amount,
    payer_name: clean(tx.debtor?.name),
    payer_iban: normIban(tx.debtor_account?.iban),
    remittance: clean((tx.remittance_information ?? []).join(" ")),
  };
  const id = clean(tx.entry_reference) ?? clean(tx.transaction_id);
  return { ...base, bank_transaction_id: id ?? fallbackId(base) };
}

/* ---------------- matching ---------------- */

export type Alias = { id: string; student_id: string; payer_name: string | null; payer_iban: string | null };

type Payer = { payer_name: string | null; payer_iban: string | null };

/**
 * IBAN first; then the full name (case, diacritics and word order don't matter) – but only if that name points to
 * exactly one student. Initials never match: a name with an initial is not used for matching at all (fullNameKey).
 */
export function matchStudent(aliases: Alias[], c: Payer) {
  const iban = normIban(c.payer_iban);
  if (iban) {
    const hit = aliases.find((a) => normIban(a.payer_iban) === iban);
    if (hit) return { studentId: hit.student_id, by: "iban" as const };
  }
  const key = fullNameKey(c.payer_name);
  if (key) {
    const students = new Set(aliases.filter((a) => fullNameKey(a.payer_name) === key).map((a) => a.student_id));
    if (students.size === 1) return { studentId: [...students][0], by: "name" as const };
  }
  return null;
}

/**
 * "Prisiminti šį mokėtoją": the alias row to write – the IBAN and the name, both when the bank gave them.
 * An alias with this IBAN is updated; otherwise a name-only alias of the same full name gets the IBAN added.
 * null = nothing to remember by (no IBAN and no full name).
 */
export function aliasToRemember(aliases: Alias[], p: Payer, studentId: string) {
  const iban = normIban(p.payer_iban);
  const key = fullNameKey(p.payer_name);
  if (!iban && !key) return null;
  const name = p.payer_name?.trim() || null;
  const existing =
    (iban && aliases.find((a) => normIban(a.payer_iban) === iban)) ||
    (key && aliases.find((a) => !a.payer_iban && fullNameKey(a.payer_name) === key)) ||
    null;
  const values = { student_id: studentId, payer_iban: iban ?? existing?.payer_iban ?? null, payer_name: name ?? existing?.payer_name ?? null };
  return existing ? { updateId: existing.id, values } : { updateId: null, values };
}

export async function loadAliases(supabase: Client, ownerId: string): Promise<Alias[]> {
  const { data, error } = await supabase.from("payer_aliases").select("id, student_id, payer_name, payer_iban").eq("owner_id", ownerId);
  if (error) throw new Error(`payer_aliases: ${error.message}`);
  return data;
}

/* ---------------- plan + insert ---------------- */

/** What an import would do: new payments (with their student, if known) and the ones skipped as duplicates. */
export async function planImport(supabase: Client, ownerId: string, candidates: Candidate[], source: BankSource) {
  // Within the batch itself, too (a statement may list the same row twice).
  const unique = [...new Map(candidates.map((c) => [c.bank_transaction_id, c])).values()];
  if (!unique.length) return { planned: [] as Planned[], duplicates: [] as Candidate[] };

  const from = unique.reduce((min, c) => (c.booked_on < min ? c.booked_on : min), unique[0].booked_on);
  const [{ data: existing, error }, aliases] = await Promise.all([
    supabase.from("payments").select("bank_transaction_id, source, booked_on, amount, payer_name").eq("owner_id", ownerId).neq("source", "manual").gte("booked_on", from),
    loadAliases(supabase, ownerId),
  ]);
  if (error) throw new Error(`payments: ${error.message}`);

  const ids = new Set(existing.map((p) => p.bank_transaction_id));
  const otherSource = new Set(existing.filter((p) => p.source !== source).map((p) => fingerprint({ ...p, amount: Number(p.amount) })));

  const planned: Planned[] = [];
  const duplicates: Candidate[] = [];
  for (const c of unique) {
    if (ids.has(c.bank_transaction_id) || otherSource.has(fingerprint(c))) {
      duplicates.push(c);
      continue;
    }
    const match = matchStudent(aliases, c);
    planned.push({ ...c, student_id: match?.studentId ?? null, matched_by: match?.by ?? null });
  }
  return { planned, duplicates };
}

/** Inserts planned payments. A row whose bank id already exists is skipped by the DB, never duplicated. */
export async function insertPlanned(supabase: Client, ownerId: string, planned: Planned[], source: BankSource) {
  if (!planned.length) return 0;
  const rows = planned.map((p) => ({
    bank_transaction_id: p.bank_transaction_id,
    booked_on: p.booked_on,
    amount: p.amount,
    payer_name: p.payer_name,
    payer_iban: p.payer_iban,
    remittance: p.remittance,
    student_id: p.student_id,
    owner_id: ownerId,
    source,
  }));
  const { data, error } = await supabase
    .from("payments")
    .upsert(rows, { onConflict: "owner_id,bank_transaction_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`payments: ${error.message}`);
  return data.length;
}
