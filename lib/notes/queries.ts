import { earnedBetween } from "@/lib/finance/queries";
import { createClient } from "@/lib/supabase/server";
import { ensureLessons, getLesson, listHeldSince, listLessonsBetween, nextLessonDay, type LessonItem } from "@/lib/lessons/queries";
import { addDays, mondayOf, todayVilnius, vilniusParts } from "@/lib/lessons/time";
import { countUnassigned, getDebts } from "@/lib/payments/queries";
import { NOTES_START, type DatedNote, type NoteFields, type OpenGap } from "./constants";

// Read-only queries for lesson notes, gaps and the Šiandien screen.
// Request-time data (createClient awaits connection()) – callers sit inside <Suspense>.

type Supabase = Awaited<ReturnType<typeof createClient>>;

const fields = (n: { done: string | null; stopped_at: string | null; homework: string | null; next_start: string | null }): NoteFields => ({
  done: n.done ?? "",
  stoppedAt: n.stopped_at ?? "",
  homework: n.homework ?? "",
  nextStart: n.next_start ?? "",
});

/** All notes of these students, newest lesson first. */
export async function listNotesForStudents(studentIds: string[], supabase: Supabase): Promise<DatedNote[]> {
  if (studentIds.length === 0) return [];
  const { data, error } = await supabase
    .from("lesson_notes")
    .select("lesson_id, done, stopped_at, homework, next_start, lessons!inner (starts_at, student_id)")
    .in("lessons.student_id", studentIds);
  if (error) throw new Error(`Nepavyko įkelti užrašų: ${error.message}`);
  return data
    .map((n) => {
      const start = vilniusParts(n.lessons.starts_at);
      return { ...fields(n), lessonId: n.lesson_id, studentId: n.lessons.student_id, startsAt: n.lessons.starts_at, date: start.date, time: start.time };
    })
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

/** Notes of these lessons, by lesson id. */
export async function notesByLesson(lessonIds: string[], supabase: Supabase) {
  const map = new Map<string, NoteFields>();
  if (lessonIds.length === 0) return map;
  const { data, error } = await supabase.from("lesson_notes").select("lesson_id, done, stopped_at, homework, next_start").in("lesson_id", lessonIds);
  if (error) throw new Error(`Nepavyko įkelti užrašų: ${error.message}`);
  for (const n of data) map.set(n.lesson_id, fields(n));
  return map;
}

/** Open (unresolved) gaps per student, oldest first. */
export async function openGapsByStudent(studentIds: string[], supabase: Supabase) {
  const map = new Map<string, OpenGap[]>();
  if (studentIds.length === 0) return map;
  const { data, error } = await supabase
    .from("gaps")
    .select("id, text, student_id")
    .in("student_id", studentIds)
    .is("resolved_at", null)
    .order("created_at");
  if (error) throw new Error(`Nepavyko įkelti spragų: ${error.message}`);
  for (const g of data) map.set(g.student_id, [...(map.get(g.student_id) ?? []), { id: g.id, text: g.text }]);
  return map;
}

/** The latest note of a lesson that started before `startsAt` (notes are newest first). */
export const latestBefore = (notes: DatedNote[], studentId: string, startsAt: string) =>
  notes.find((n) => n.studentId === studentId && n.startsAt < startsAt) ?? null;

/* ---------------- Pamoka panel ---------------- */

/** Everything the Pamoka panel shows. Plain data – safe to pass to client components. */
export async function getLessonPanel(lessonId: string) {
  const supabase = await createClient();
  const lesson = await getLesson(lessonId, supabase);
  if (!lesson) return null;

  const [notes, gaps, next] = await Promise.all([
    listNotesForStudents([lesson.studentId], supabase),
    openGapsByStudent([lesson.studentId], supabase),
    supabase
      .from("lessons")
      .select("starts_at")
      .eq("student_id", lesson.studentId)
      .neq("status", "atsaukta")
      .gt("starts_at", lesson.startsAt)
      .order("starts_at")
      .limit(1),
  ]);

  const own = notes.find((n) => n.lessonId === lesson.id);
  const nextStart = next.data?.[0]?.starts_at;
  return {
    today: todayVilnius(),
    lesson,
    note: own ? ({ done: own.done, stoppedAt: own.stoppedAt, homework: own.homework, nextStart: own.nextStart } satisfies NoteFields) : null,
    previous: notes.filter((n) => n.startsAt < lesson.startsAt).slice(0, 3),
    gaps: gaps.get(lesson.studentId) ?? [],
    nextLesson: nextStart ? vilniusParts(nextStart) : null,
  };
}

export type LessonPanelData = NonNullable<Awaited<ReturnType<typeof getLessonPanel>>>;

/* ---------------- Laukia užrašų ---------------- */

/** Held lessons (from NOTES_START on) that have no notes yet, newest first. */
export async function listAwaitingNotes(supabase?: Supabase) {
  const client = supabase ?? (await createClient());
  const held = await listHeldSince(NOTES_START, client);
  const notes = await notesByLesson(
    held.map((l) => l.id),
    client
  );
  return held.filter((l) => !notes.has(l.id));
}

export async function countAwaitingNotes() {
  return (await listAwaitingNotes()).length;
}

/* ---------------- Šiandien ---------------- */

/** Per lesson: what the Šiandien screen shows next to it. */
export type LessonContext = {
  startFrom: string | null; // "Pradėti nuo" of the latest earlier note
  hasEarlierNotes: boolean;
  previous: DatedNote | null; // that latest earlier note
  hasNote: boolean; // this lesson already has notes
  gaps: OpenGap[];
};

export async function getToday() {
  const supabase = await createClient();
  await ensureLessons(supabase);
  const now = Date.now();
  const today = todayVilnius();
  const monday = mondayOf(today);

  const [lessons, week, awaiting, debts, unassigned] = await Promise.all([
    listLessonsBetween(today, addDays(today, 1), supabase),
    earnedBetween(monday, addDays(monday, 7), supabase), // the same number as Finansai → Savaitė
    listAwaitingNotes(supabase),
    getDebts(supabase),
    countUnassigned(supabase),
  ]);

  // Nothing left today → also load the next day that has lessons.
  const endOf = (l: LessonItem) => Date.parse(l.startsAt) + 60 * 60_000;
  let nextDay: { date: string; lessons: LessonItem[] } | null = null;
  if (!lessons.some((l) => l.status !== "atsaukta" && endOf(l) > now)) {
    const date = await nextLessonDay(today, supabase);
    if (date) {
      const dayLessons = await listLessonsBetween(date, addDays(date, 1), supabase);
      nextDay = { date, lessons: dayLessons.filter((l) => l.status !== "atsaukta") };
    }
  }

  const all = [...lessons, ...(nextDay?.lessons ?? [])];
  const studentIds = [...new Set(all.map((l) => l.studentId))];
  const [notes, gaps] = await Promise.all([listNotesForStudents(studentIds, supabase), openGapsByStudent(studentIds, supabase)]);

  const context: Record<string, LessonContext> = {};
  for (const l of all) {
    const previous = latestBefore(notes, l.studentId, l.startsAt);
    context[l.id] = {
      startFrom: previous?.nextStart.trim() || null,
      hasEarlierNotes: previous !== null,
      previous,
      hasNote: notes.some((n) => n.lessonId === l.id),
      gaps: gaps.get(l.studentId) ?? [],
    };
  }

  return {
    now,
    today,
    lessons,
    nextDay,
    context,
    stats: {
      awaiting: awaiting.length,
      awaitingNames: [...new Set(awaiting.map((l) => l.name))],
      weekEarned: week.total,
      weekHeld: week.count,
      debtTotal: debts.total,
      debtors: debts.debtors.map((d) => d.name),
      unassigned: unassigned.count,
      unassignedTotal: unassigned.total,
    },
  };
}

export type TodayData = Awaited<ReturnType<typeof getToday>>;

/** Notes of these lessons as a plain object (lesson id → fields) – for the profile timeline. */
export async function notesForLessons(lessonIds: string[]) {
  const supabase = await createClient();
  return Object.fromEntries(await notesByLesson(lessonIds, supabase));
}
