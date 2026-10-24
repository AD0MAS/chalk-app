"use server";

import { revalidatePath } from "next/cache";
import { scheduleSync } from "@/lib/google/sync";
import { createClient } from "@/lib/supabase/server";
import { isEmptyNote, NOTE_MAX, type NoteFields, type OpenGap } from "./constants";
import { getLessonPanel, openGapsByStudent } from "./queries";

// Server Actions for the Pamoka panel. Every write goes through RLS (owner only).
// Autosave and gap edits do not revalidate: the panel refreshes the page once when it closes,
// so the screen behind it does not re-render on every keystroke.

export type SaveResult = { ok: true } | { ok: false; message: string };

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const SAVE_FAILED = "Nepavyko išsaugoti. Pabandyk dar kartą.";

export async function loadLessonPanel(lessonId: string) {
  if (!isId(lessonId)) return null;
  return getLessonPanel(lessonId);
}

/**
 * Autosave of the 4 note fields. One note per lesson (upsert on lesson_id).
 * All fields empty → the note is removed, so "Laukia užrašų" stays honest.
 * Not allowed on a cancelled lesson.
 */
export async function saveLessonNote(lessonId: string, note: NoteFields): Promise<SaveResult> {
  if (!isId(lessonId)) return { ok: false, message: "Pamoka nerasta." };
  const clean = {
    done: String(note.done ?? "").slice(0, NOTE_MAX),
    stoppedAt: String(note.stoppedAt ?? "").slice(0, NOTE_MAX),
    homework: String(note.homework ?? "").slice(0, NOTE_MAX),
    nextStart: String(note.nextStart ?? "").slice(0, NOTE_MAX),
  };

  const supabase = await createClient();
  const { data: lesson } = await supabase.from("lessons").select("id, status").eq("id", lessonId).maybeSingle();
  if (!lesson) return { ok: false, message: "Pamoka nerasta." };
  if (lesson.status === "atsaukta") return { ok: false, message: "Atšauktai pamokai užrašų nereikia." };

  const nullable = (v: string) => (v.trim() === "" ? null : v);
  const { error } = isEmptyNote(clean)
    ? await supabase.from("lesson_notes").delete().eq("lesson_id", lessonId)
    : await supabase.from("lesson_notes").upsert(
        {
          lesson_id: lessonId,
          done: nullable(clean.done),
          stopped_at: nullable(clean.stoppedAt),
          homework: nullable(clean.homework),
          next_start: nullable(clean.nextStart),
        },
        { onConflict: "lesson_id" }
      );
  if (error) {
    console.error("saveLessonNote:", error.message);
    return { ok: false, message: SAVE_FAILED };
  }
  return { ok: true };
}

/* ---------------- gaps from the panel ---------------- */

type GapsResult = { ok: true; gaps: OpenGap[] } | { ok: false; message: string };

async function openGaps(studentId: string): Promise<GapsResult> {
  const supabase = await createClient();
  return { ok: true, gaps: (await openGapsByStudent([studentId], supabase)).get(studentId) ?? [] };
}

export async function addPanelGap(studentId: string, text: string): Promise<GapsResult> {
  if (!isId(studentId)) return { ok: false, message: "Mokinys nerastas." };
  const value = text.trim();
  if (!value) return { ok: false, message: "Įrašyk spragą." };
  if (value.length > 200) return { ok: false, message: "Per ilga (iki 200 simbolių)." };
  const supabase = await createClient();
  const { error } = await supabase.from("gaps").insert({ student_id: studentId, text: value });
  if (error) {
    console.error("addPanelGap:", error.message);
    return { ok: false, message: SAVE_FAILED };
  }
  return openGaps(studentId);
}

export async function resolvePanelGap(studentId: string, gapId: string): Promise<GapsResult> {
  if (!isId(studentId) || !isId(gapId)) return { ok: false, message: "Spraga nerasta." };
  const supabase = await createClient();
  const { error } = await supabase.from("gaps").update({ resolved_at: new Date().toISOString() }).eq("id", gapId);
  if (error) {
    console.error("resolvePanelGap:", error.message);
    return { ok: false, message: SAVE_FAILED };
  }
  return openGaps(studentId);
}

/* ---------------- Lenta ---------------- */

/** Saves the student's permanent tldraw board link (Lenta button, when it was missing). */
export async function saveBoardUrl(studentId: string, url: string): Promise<SaveResult> {
  if (!isId(studentId)) return { ok: false, message: "Mokinys nerastas." };
  const trimmed = url.trim();
  let value: string;
  try {
    const parsed = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("protocol");
    value = parsed.toString();
  } catch {
    return { ok: false, message: "Įklijuok visą nuorodą, pvz. https://www.tldraw.com/…" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ board_url: value }).eq("id", studentId);
  if (error) {
    console.error("saveBoardUrl:", error.message);
    return { ok: false, message: SAVE_FAILED };
  }
  scheduleSync(); // the Lenta link is in the Google event description
  revalidatePath("/", "layout");
  return { ok: true };
}
