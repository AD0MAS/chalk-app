"use server";

import { revalidatePath } from "next/cache";
import { scheduleSync } from "@/lib/google/sync";
import { createClient } from "@/lib/supabase/server";
import { LESSONS_START } from "./constants";
import { listLessonsBetween, listLessonStudents } from "./queries";
import { addDays, isDate, isTime, todayVilnius, vilniusToIso } from "./time";

// Server Actions for lessons. Every write goes through RLS (owner only).

export type ActionResult = { ok: true } | { ok: false; message: string };

const SAVE_FAILED = "Nepavyko išsaugoti. Pabandyk dar kartą.";
const fail = (message: string): ActionResult => ({ ok: false, message });

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

function done(): ActionResult {
  scheduleSync(); // Google Calendar follows after the response – never blocks the UI
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------------- reads for dialogs ---------------- */

/** That day's lessons – the Perkelti and + Pamoka dialogs show them and warn about overlaps. */
export async function getDayLessons(date: string) {
  if (!isDate(date)) return [];
  return listLessonsBetween(date, addDays(date, 1));
}

export async function getLessonStudents() {
  return listLessonStudents();
}

/* ---------------- move ---------------- */

/**
 * "Tik šią pamoką" (once): moves one lesson; its original time stays in original_starts_at.
 * "Nuo dabar visam laikui" (series): SQL reschedule_series – closes the weekly slot, opens a new one,
 * prunes only untouched future lessons and regenerates. Past, cancelled and moved lessons are never touched.
 * Overlaps with other lessons are only a warning in the dialog; moving is always allowed.
 */
export async function moveLesson(lessonId: string, date: string, time: string, mode: "once" | "series"): Promise<ActionResult> {
  if (!isId(lessonId)) return fail("Pamoka nerasta.");
  if (!isDate(date) || !isTime(time)) return fail("Pasirink datą ir laiką.");
  if (date < todayVilnius()) return fail("Negalima perkelti į praeitį.");

  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, starts_at, original_starts_at, status, slot_id")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return fail("Pamoka nerasta.");
  if (lesson.status === "atsaukta") return fail("Atšauktos pamokos perkelti negalima – pirma ją atkurk.");

  const startsAt = vilniusToIso(date, time);

  if (mode === "series") {
    const { error } = await supabase.rpc("reschedule_series", { p_lesson_id: lessonId, p_new_start: startsAt });
    if (error) {
      console.error("reschedule_series:", error.message);
      return fail(error.message.includes("tik būsimą") ? "Visam laikui galima perkelti tik būsimą savaitinę pamoką." : SAVE_FAILED);
    }
    return done();
  }

  // Once. Moving it back to its original time makes it a normal lesson again.
  const original = lesson.original_starts_at ?? lesson.starts_at;
  const backHome = Date.parse(original) === Date.parse(startsAt);
  const { error } = await supabase
    .from("lessons")
    .update({ starts_at: startsAt, original_starts_at: backHome || !lesson.slot_id ? null : original })
    .eq("id", lessonId);
  if (error) {
    console.error("moveLesson:", error.message);
    return fail(SAVE_FAILED);
  }
  return done();
}

/* ---------------- cancel / restore ---------------- */

/** Atšaukta – never charged (balance counts only 'ivyko'). */
export async function cancelLesson(lessonId: string, reason: string): Promise<ActionResult> {
  if (!isId(lessonId)) return fail("Pamoka nerasta.");
  const text = reason.trim().slice(0, 200) || null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .update({ status: "atsaukta", cancelled_at: new Date().toISOString(), cancel_reason: text })
    .eq("id", lessonId);
  if (error) {
    console.error("cancelLesson:", error.message);
    return fail(SAVE_FAILED);
  }
  return done();
}

/** Undo a cancellation: back to Suplanuota (a past one then counts as Įvyko again). */
export async function restoreLesson(lessonId: string): Promise<ActionResult> {
  if (!isId(lessonId)) return fail("Pamoka nerasta.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .update({ status: "suplanuota", cancelled_at: null, cancel_reason: null })
    .eq("id", lessonId);
  if (error) {
    console.error("restoreLesson:", error.message);
    return fail(SAVE_FAILED);
  }
  return done();
}

/* ---------------- one-off lesson ---------------- */

/** "+ Pamoka": a one-off lesson for any (non-archived) student, at the student's current price. */
export async function createOneOffLesson(studentId: string, date: string, time: string): Promise<ActionResult> {
  if (!isId(studentId)) return fail("Pasirink mokinį.");
  if (!isDate(date) || !isTime(time)) return fail("Pasirink datą ir laiką.");
  if (date < LESSONS_START) return fail(`Pamokos skaičiuojamos nuo ${LESSONS_START}.`);

  const supabase = await createClient();
  const { data: student } = await supabase.from("students").select("price, status").eq("id", studentId).maybeSingle();
  if (!student || student.status === "archyvuotas") return fail("Mokinys nerastas.");

  const { error } = await supabase.from("lessons").insert({
    student_id: studentId,
    starts_at: vilniusToIso(date, time),
    duration_minutes: 60,
    price: student.price,
    kind: "one_off",
  });
  if (error) {
    console.error("createOneOffLesson:", error.message);
    return fail(SAVE_FAILED);
  }
  return done();
}
