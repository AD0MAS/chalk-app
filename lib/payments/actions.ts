"use server";

import { revalidatePath } from "next/cache";
import { addDays, isDate, todayVilnius } from "@/lib/lessons/time";
import { createClient } from "@/lib/supabase/server";
import { parseAmount } from "./constants";

// Server Actions for manual payments and the opening balance. Every write goes through RLS (owner only).

export type ActionResult = { ok: true } | { ok: false; message: string };

const SAVE_FAILED = "Nepavyko išsaugoti. Pabandyk dar kartą.";
const fail = (message: string): ActionResult => ({ ok: false, message });
const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

function done(): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true };
}

export type PaymentInput = { id?: string; studentId: string; amount: string; date: string; note: string };

/** Adds (no id) or edits a manual payment. Amount > 0, date not more than a year ahead. */
export async function savePayment(input: PaymentInput): Promise<ActionResult> {
  if (!isId(input.studentId)) return fail("Pasirink mokinį.");
  const amount = parseAmount(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return fail("Įrašyk sumą, pvz. 25 arba 22,50.");
  if (amount > 10000) return fail("Per didelė suma.");
  if (!isDate(input.date)) return fail("Pasirink datą.");
  if (input.date > addDays(todayVilnius(), 366)) return fail("Data per toli ateityje.");
  const note = input.note.trim().slice(0, 300) || null;

  const supabase = await createClient();
  const row = { student_id: input.studentId, amount, booked_on: input.date, note };

  if (input.id) {
    if (!isId(input.id)) return fail("Mokėjimas nerastas.");
    // Only manual payments are edited here; bank payments come from the bank (Phase 3).
    const { data, error } = await supabase.from("payments").update(row).eq("id", input.id).eq("source", "manual").select("id");
    if (error || !data?.length) {
      if (error) console.error("savePayment (update):", error.message);
      return fail(error ? SAVE_FAILED : "Mokėjimas nerastas.");
    }
    return done();
  }

  const { error } = await supabase.from("payments").insert({ ...row, source: "manual" });
  if (error) {
    console.error("savePayment (insert):", error.message);
    return fail(SAVE_FAILED);
  }
  return done();
}

/** Deletes one manual payment (the dialog asks for confirmation first). */
export async function deletePayment(id: string): Promise<ActionResult> {
  if (!isId(id)) return fail("Mokėjimas nerastas.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("payments").delete().eq("id", id).eq("source", "manual").select("id");
  if (error) {
    console.error("deletePayment:", error.message);
    return fail("Nepavyko ištrinti. Pabandyk dar kartą.");
  }
  if (!data?.length) return fail("Mokėjimas nerastas.");
  return done();
}

/** "Pradinis likutis": negative = debt on 2026-10-21, positive = prepaid, 0 = none. */
export async function setOpeningBalance(studentId: string, amount: string): Promise<ActionResult> {
  if (!isId(studentId)) return fail("Mokinys nerastas.");
  const value = amount.trim() === "" ? 0 : parseAmount(amount);
  if (!Number.isFinite(value)) return fail("Įrašyk sumą, pvz. 50 arba 22,50.");
  if (Math.abs(value) > 10000) return fail("Per didelė suma.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("students").update({ opening_balance: value }).eq("id", studentId).select("id");
  if (error) {
    console.error("setOpeningBalance:", error.message);
    return fail(SAVE_FAILED);
  }
  if (!data?.length) return fail("Mokinys nerastas.");
  return done();
}
