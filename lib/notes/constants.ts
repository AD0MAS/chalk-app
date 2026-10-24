// Lesson notes (SPEC §1 Lesson notes). Shared by server and client code.

/**
 * "Laukia užrašų" counts held lessons from this day on. Chalk started on 2026-10-21;
 * notes are expected from the first full day after it (project decision, 2026-10-21).
 */
export const NOTES_START = "2026-10-22";

/** Max length of one note field. */
export const NOTE_MAX = 2000;

export type NoteFields = {
  done: string; // Ką darėm
  stoppedAt: string; // Kur baigėm
  homework: string; // ND
  nextStart: string; // Kitą kartą pradėti nuo
};

export const EMPTY_NOTE: NoteFields = { done: "", stoppedAt: "", homework: "", nextStart: "" };

export const NOTE_LABELS: Record<keyof NoteFields, string> = {
  done: "Ką darėm",
  stoppedAt: "Kur baigėm",
  homework: "ND",
  nextStart: "Kitą kartą pradėti nuo",
};

export const isEmptyNote = (n: NoteFields) => !n.done.trim() && !n.stoppedAt.trim() && !n.homework.trim() && !n.nextStart.trim();

/** A saved note together with the lesson it belongs to. */
export type DatedNote = NoteFields & {
  lessonId: string;
  studentId: string;
  startsAt: string;
  date: string; // Vilnius
  time: string;
};

export type OpenGap = { id: string; text: string };
