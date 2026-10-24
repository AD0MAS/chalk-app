import { scheduleSync } from "@/lib/google/sync";
import { createClient } from "@/lib/supabase/server";
import { displayNames } from "@/lib/names";
import { formatGrade, type StudentTone } from "@/lib/students/constants";
import type { LessonStatus } from "./constants";
import { addDays, vilniusParts, vilniusToIso, fromMinutes } from "./time";

// Read-only lesson queries. They run at request time (createClient awaits connection()),
// so callers must sit inside <Suspense>. RLS makes sure only Adomas's own rows come back.

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type { LessonStatus };

/**
 * Rolling generation until the end of next month (SQL function generate_lessons). Cheap and idempotent,
 * so lesson pages simply run it on every load. A failure never breaks the page.
 */
export async function ensureLessons(supabase?: Supabase) {
  const client = supabase ?? (await createClient());
  const { data: created, error } = await client.rpc("generate_lessons");
  if (error) console.error("generate_lessons:", error.message);
  if (created) scheduleSync(); // new lessons → Google Calendar
}

/** Everything a lesson block, row or dialog needs – plain data, safe to pass to client components. */
export type LessonItem = {
  id: string;
  studentId: string;
  name: string; // display name (DESIGN.md §9)
  fullName: string;
  grade: string; // "12 kl B"
  tone: StudentTone;
  meetUrl: string | null;
  boardUrl: string | null;
  startsAt: string;
  date: string; // Vilnius
  time: string; // "18:00"
  endTime: string;
  minutes: number; // start, minutes since local midnight
  status: LessonStatus; // effective: a past non-cancelled lesson is 'ivyko'
  kind: "regular" | "one_off";
  slotId: string | null;
  isFuture: boolean;
  original: { date: string; time: string } | null; // set if only this lesson was moved
  cancelReason: string | null;
  price: number;
};

const LESSON_FIELDS =
  "id, student_id, slot_id, starts_at, duration_minutes, price, kind, effective_status, original_starts_at, cancel_reason, students (first_name, last_name, grade, math_level, tone, meet_url, board_url)";

type Row = {
  id: string | null;
  student_id: string | null;
  slot_id: string | null;
  starts_at: string | null;
  duration_minutes: number | null;
  price: number | null;
  kind: "regular" | "one_off" | null;
  effective_status: LessonStatus | null;
  original_starts_at: string | null;
  cancel_reason: string | null;
  students: {
    first_name: string;
    last_name: string | null;
    grade: number;
    math_level: "A" | "B" | null;
    tone: StudentTone;
    meet_url: string | null;
    board_url: string | null;
  } | null;
};

function toItem(row: Row, names: Map<string, string>, now: number): LessonItem {
  const s = row.students!;
  const start = vilniusParts(row.starts_at!);
  const original = row.original_starts_at ? vilniusParts(row.original_starts_at) : null;
  return {
    id: row.id!,
    studentId: row.student_id!,
    name: names.get(row.student_id!) ?? s.first_name,
    fullName: [s.first_name, s.last_name].filter(Boolean).join(" "),
    grade: formatGrade(s.grade, s.math_level),
    tone: s.tone,
    meetUrl: s.meet_url,
    boardUrl: s.board_url,
    startsAt: row.starts_at!,
    date: start.date,
    time: start.time,
    endTime: fromMinutes((start.minutes + (row.duration_minutes ?? 60)) % (24 * 60)),
    minutes: start.minutes,
    status: row.effective_status!,
    kind: row.kind!,
    slotId: row.slot_id,
    isFuture: Date.parse(row.starts_at!) > now,
    original: original && row.original_starts_at !== row.starts_at ? { date: original.date, time: original.time } : null,
    cancelReason: row.cancel_reason,
    price: Number(row.price),
  };
}

/** Display names for all non-archived students ("Ieva K." when two share a first name). */
async function studentNames(supabase: Supabase) {
  const { data, error } = await supabase.from("students").select("id, first_name, last_name").neq("status", "archyvuotas");
  if (error) throw new Error(`Nepavyko įkelti mokinių: ${error.message}`);
  return displayNames(data.map((s) => ({ id: s.id, firstName: s.first_name, lastName: s.last_name })));
}

/** Lessons from `fromDate` (inclusive) to `toDate` (exclusive), Vilnius days, oldest first. */
export async function listLessonsBetween(fromDate: string, toDate: string, supabase?: Supabase) {
  const client = supabase ?? (await createClient());
  const [names, { data, error }] = await Promise.all([
    studentNames(client),
    client
      .from("lessons_view")
      .select(LESSON_FIELDS)
      .gte("starts_at", vilniusToIso(fromDate, "00:00"))
      .lt("starts_at", vilniusToIso(toDate, "00:00"))
      .order("starts_at"),
  ]);
  if (error) throw new Error(`Nepavyko įkelti pamokų: ${error.message}`);
  const now = Date.now();
  return (data as Row[]).map((r) => toItem(r, names, now));
}

/** One lesson by id, or null. */
export async function getLesson(lessonId: string, supabase?: Supabase) {
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) return null;
  const client = supabase ?? (await createClient());
  const [names, { data, error }] = await Promise.all([
    studentNames(client),
    client.from("lessons_view").select(LESSON_FIELDS).eq("id", lessonId).maybeSingle(),
  ]);
  if (error) throw new Error(`Nepavyko įkelti pamokos: ${error.message}`);
  return data ? toItem(data as Row, names, Date.now()) : null;
}

/** Held lessons (effective Įvyko) from `fromDate` on, newest first – for "Laukia užrašų". */
export async function listHeldSince(fromDate: string, supabase?: Supabase) {
  const client = supabase ?? (await createClient());
  const [names, { data, error }] = await Promise.all([
    studentNames(client),
    client
      .from("lessons_view")
      .select(LESSON_FIELDS)
      .eq("effective_status", "ivyko")
      .gte("starts_at", vilniusToIso(fromDate, "00:00"))
      .order("starts_at", { ascending: false }),
  ]);
  if (error) throw new Error(`Nepavyko įkelti pamokų: ${error.message}`);
  const now = Date.now();
  return (data as Row[]).map((r) => toItem(r, names, now));
}

/** The first day after `date` that has a lesson which is not cancelled, or null. */
export async function nextLessonDay(date: string, supabase?: Supabase) {
  const client = supabase ?? (await createClient());
  const { data, error } = await client
    .from("lessons")
    .select("starts_at")
    .neq("status", "atsaukta")
    .gte("starts_at", vilniusToIso(addDays(date, 1), "00:00"))
    .order("starts_at")
    .limit(1);
  if (error) throw new Error(`Nepavyko įkelti pamokų: ${error.message}`);
  return data[0] ? vilniusParts(data[0].starts_at).date : null;
}

/** One week (Monday → Sunday) for Tvarkaraštis. Generates lessons first. */
export async function listWeekLessons(monday: string) {
  const supabase = await createClient();
  await ensureLessons(supabase);
  return listLessonsBetween(monday, addDays(monday, 7), supabase);
}

/** All lessons of one student, newest first – profile tab "Užrašai". Generates lessons first. */
export async function listStudentLessons(studentId: string) {
  const supabase = await createClient();
  await ensureLessons(supabase);
  const [names, { data, error }] = await Promise.all([
    studentNames(supabase),
    supabase.from("lessons_view").select(LESSON_FIELDS).eq("student_id", studentId).order("starts_at", { ascending: false }),
  ]);
  if (error) throw new Error(`Nepavyko įkelti pamokų: ${error.message}`);
  const now = Date.now();
  return (data as Row[]).map((r) => toItem(r, names, now));
}

/** Students a lesson can be added for (not archived), with their price – for "+ Pamoka". */
export async function listLessonStudents() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, grade, math_level, tone, price, status")
    .neq("status", "archyvuotas")
    .order("first_name");
  if (error) throw new Error(`Nepavyko įkelti mokinių: ${error.message}`);
  const names = displayNames(data.map((s) => ({ id: s.id, firstName: s.first_name, lastName: s.last_name })));
  return data.map((s) => ({
    id: s.id,
    name: names.get(s.id) ?? s.first_name,
    grade: formatGrade(s.grade, s.math_level),
    tone: s.tone,
    price: Number(s.price),
    status: s.status,
  }));
}

export type LessonStudent = Awaited<ReturnType<typeof listLessonStudents>>[number];
