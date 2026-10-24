import "server-only";
import { after } from "next/server";
import { displayNames } from "@/lib/names";
import { formatGrade } from "@/lib/students/constants";
import { createAdminClient, type AdminClient } from "@/lib/supabase/admin";
import { deleteEvent, ensureCalendar, GoogleApiError, listEventIds, upsertEvent, type EventBody } from "./calendar";
import { accessToken, GoogleAuthError, isGoogleConfigured } from "./oauth";
import { SYNC_OFF, type SyncInfo } from "./types";

// One-way sync Chalk → Google Calendar "Pamokos" (docs/SPEC.md §2).
//
// The database decides WHAT must be synced (supabase/migrations/20261021120000_google_calendar.sql):
// changed lessons are gcal_dirty, deleted ones sit in gcal_deletions. This file only pushes them.
// Nothing here ever blocks the UI: it runs after the response (scheduleSync) or from the navbar dot,
// and a failure just leaves the lesson dirty with gcal_error ("nesinchronizuota") for the next try.

const LOCK_MS = 2 * 60_000; // a crashed sync frees the lock after 2 min
const BATCH = 200;
const PARALLEL = 4; // gentle on Google's per-user rate limit

/** Every lesson has a fixed event id, so pushing twice never makes a duplicate. */
export const eventIdFor = (lessonId: string) => "chalk" + lessonId.replaceAll("-", "").toLowerCase();

type Connection = { owner_id: string; refresh_token: string; calendar_id: string; last_error: string | null; last_sync_at: string | null };

/** Chalk has one user, so there is at most one usable connection. */
async function loadConnection(supabase: AdminClient): Promise<Connection | null> {
  const { data, error } = await supabase
    .from("google_connection")
    .select("owner_id, refresh_token, calendar_id, last_error, last_sync_at")
    .not("refresh_token", "is", null)
    .not("calendar_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`google_connection: ${error.message}`);
  return data as Connection | null;
}

/* ---------------- status (navbar dot, Nustatymai) ---------------- */

export async function getSyncInfo(supabase = createAdminClient()): Promise<SyncInfo> {
  if (!isGoogleConfigured()) return SYNC_OFF;
  const conn = await loadConnection(supabase);
  if (!conn) return SYNC_OFF;

  const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0;
  const lessons = () => supabase.from("lessons").select("id", { count: "exact", head: true }).eq("owner_id", conn.owner_id).eq("gcal_dirty", true);
  const deletions = () => supabase.from("gcal_deletions").select("id", { count: "exact", head: true }).eq("owner_id", conn.owner_id);
  const [dirty, dirtyFailed, deleted, deletedFailed] = await Promise.all([
    count(lessons()),
    count(lessons().not("gcal_error", "is", null)),
    count(deletions()),
    count(deletions().not("error", "is", null)),
  ]);
  const pending = dirty + deleted;
  const failed = dirtyFailed + deletedFailed;
  return {
    state: conn.last_error || failed ? "error" : pending ? "syncing" : "synced",
    pending,
    failed,
    message: conn.last_error,
    lastSyncAt: conn.last_sync_at,
  };
}

/* ---------------- the sync ---------------- */

/** Run a sync after the current response is sent (Server Actions, page renders). Never throws. */
export function scheduleSync() {
  after(() => syncCalendar().then(() => undefined, (e) => console.error("Google sync:", e)));
}

/**
 * Pushes every pending change to Google. `full` ("Sinchronizuoti iš naujo") also makes sure the
 * calendar exists, removes Chalk events whose lesson is gone and re-sends every lesson.
 * If another sync is already running, it returns the current status right away.
 */
export async function syncCalendar({ full = false } = {}): Promise<SyncInfo> {
  const supabase = createAdminClient();
  if (!isGoogleConfigured()) return SYNC_OFF;
  const conn = await loadConnection(supabase);
  if (!conn) return SYNC_OFF;
  if (!(await claimLock(supabase, conn.owner_id))) return getSyncInfo(supabase);

  let lastError: string | null = null;
  try {
    const token = await accessToken(conn.refresh_token);
    let calendarId = conn.calendar_id;
    if (full) calendarId = await reconcile(supabase, token, conn);
    await pushDeletions(supabase, token, conn.owner_id, calendarId);
    await pushLessons(supabase, token, conn.owner_id, calendarId);
  } catch (e) {
    console.error("Google sync failed:", e);
    lastError =
      e instanceof GoogleAuthError && e.revoked
        ? "Google prieiga atšaukta arba pasibaigė – prijunk Google Calendar iš naujo."
        : e instanceof CalendarMissing
          ? "Kalendorius „Pamokos“ nerastas. Spausk „Sinchronizuoti iš naujo“ – Chalk jį sukurs."
          : "Nepavyko susisiekti su Google Calendar. Bandysiu dar kartą.";
  } finally {
    await supabase
      .from("google_connection")
      .update({ sync_lock_until: null, last_error: lastError, ...(lastError ? {} : { last_sync_at: new Date().toISOString() }) })
      .eq("owner_id", conn.owner_id);
  }
  return getSyncInfo(supabase);
}

class CalendarMissing extends Error {}

/** Atomic "only one sync at a time": succeeds only if nobody holds a fresh lock. */
async function claimLock(supabase: AdminClient, ownerId: string) {
  const now = new Date();
  const { data } = await supabase
    .from("google_connection")
    .update({ sync_lock_until: new Date(now.getTime() + LOCK_MS).toISOString() })
    .eq("owner_id", ownerId)
    .or(`sync_lock_until.is.null,sync_lock_until.lt.${now.toISOString()}`)
    .select("owner_id");
  return !!data?.length;
}

/** "Sinchronizuoti iš naujo": calendar exists, no orphan Chalk events, every lesson re-sent. */
async function reconcile(supabase: AdminClient, token: string, conn: Connection) {
  const calendar = await ensureCalendar(token, conn.calendar_id);
  if (calendar.created) {
    await supabase.from("google_connection").update({ calendar_id: calendar.id }).eq("owner_id", conn.owner_id);
  }

  const { data: lessons, error } = await supabase.from("lessons").select("id").eq("owner_id", conn.owner_id).neq("status", "atsaukta");
  if (error) throw new Error(`lessons: ${error.message}`);
  const keep = new Set(lessons.map((l) => eventIdFor(l.id)));

  // Only events Chalk made (id "chalk…") – anything Adomas added to "Pamokos" by hand stays.
  const orphans = (await listEventIds(token, calendar.id)).filter((id) => id.startsWith("chalk") && !keep.has(id));
  await inParallel(orphans, PARALLEL, (id) => deleteEvent(token, calendar.id, id));

  const { error: markError } = await supabase.from("lessons").update({ gcal_dirty: true }).eq("owner_id", conn.owner_id);
  if (markError) throw new Error(`lessons: ${markError.message}`);
  return calendar.id;
}

async function pushDeletions(supabase: AdminClient, token: string, ownerId: string, calendarId: string) {
  const { data: rows, error } = await supabase.from("gcal_deletions").select("id, lesson_id").eq("owner_id", ownerId).order("id").limit(500);
  if (error) throw new Error(`gcal_deletions: ${error.message}`);
  if (!rows.length) return;

  // A lesson that exists again (e.g. put back by a restore) is handled by pushLessons instead.
  const { data: existing } = await supabase.from("lessons").select("id").in("id", [...new Set(rows.map((r) => r.lesson_id))]);
  const alive = new Set((existing ?? []).map((l) => l.id));

  await inParallel(rows, PARALLEL, async (row) => {
    try {
      if (!alive.has(row.lesson_id)) await deleteEvent(token, calendarId, eventIdFor(row.lesson_id));
      await supabase.from("gcal_deletions").delete().eq("id", row.id);
    } catch (e) {
      await supabase.from("gcal_deletions").update({ error: errorText(e) }).eq("id", row.id);
    }
  });
}

type StudentRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  grade: number;
  math_level: "A" | "B" | null;
  status: string;
  meet_url: string | null;
  board_url: string | null;
};

async function pushLessons(supabase: AdminClient, token: string, ownerId: string, calendarId: string) {
  const { data: students, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, grade, math_level, status, meet_url, board_url")
    .eq("owner_id", ownerId);
  if (error) throw new Error(`students: ${error.message}`);
  const byId = new Map<string, StudentRow>(students.map((s) => [s.id, s]));
  // Same display names as the app (DESIGN.md §9): "Ieva K." when two active students share a name.
  const active = students.filter((s) => s.status !== "archyvuotas");
  const names = displayNames(active.map((s) => ({ id: s.id, firstName: s.first_name, lastName: s.last_name })));

  const attempted = new Set<string>();
  for (let pass = 0; pass < 5; pass++) {
    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("id, student_id, starts_at, duration_minutes, status, gcal_event_id, gcal_version")
      .eq("owner_id", ownerId)
      .eq("gcal_dirty", true)
      .order("starts_at")
      .limit(BATCH);
    if (lessonsError) throw new Error(`lessons: ${lessonsError.message}`);
    // Lessons changed while we were pushing come back dirty – take them in the next pass.
    const todo = lessons.filter((l) => !attempted.has(l.id));
    if (!todo.length) return;
    todo.forEach((l) => attempted.add(l.id));

    await inParallel(todo, PARALLEL, async (lesson) => {
      const eventId = eventIdFor(lesson.id);
      try {
        const student = byId.get(lesson.student_id);
        if (lesson.status === "atsaukta" || !student) {
          await deleteEvent(token, calendarId, eventId); // cancelled → no event
        } else {
          const name = names.get(student.id) ?? student.first_name.trim();
          await upsertEvent(token, calendarId, eventId, eventBody(lesson, student, name), !!lesson.gcal_event_id);
        }
        // Done – unless the lesson changed meanwhile (version moved on): then it stays dirty.
        await supabase
          .from("lessons")
          .update({ gcal_event_id: lesson.status === "atsaukta" ? null : eventId, gcal_dirty: false, gcal_error: null })
          .eq("id", lesson.id)
          .eq("gcal_version", lesson.gcal_version);
      } catch (e) {
        // An insert that 404s means the calendar itself is gone – stop and say so.
        if (e instanceof GoogleApiError && e.status === 404) throw new CalendarMissing();
        await supabase.from("lessons").update({ gcal_error: errorText(e) }).eq("id", lesson.id);
      }
    });
  }
}

function eventBody(
  lesson: { id: string; starts_at: string; duration_minutes: number },
  student: StudentRow,
  name: string
): EventBody {
  const start = new Date(lesson.starts_at);
  const end = new Date(start.getTime() + lesson.duration_minutes * 60_000);
  const description = [
    student.meet_url && `Google Meet: ${student.meet_url}`,
    student.board_url && `Lenta: ${student.board_url}`,
    "",
    "Šią pamoką valdo Chalk – perkelk ar atšauk ją Chalk'e, ne čia.",
  ]
    .filter((line) => typeof line === "string")
    .join("\n")
    .trim();
  return {
    summary: `${name} ${formatGrade(student.grade, student.math_level)}`, // "Vardenis 11 kl A"
    description,
    start: { dateTime: start.toISOString(), timeZone: "Europe/Vilnius" },
    end: { dateTime: end.toISOString(), timeZone: "Europe/Vilnius" },
    status: "confirmed",
    colorId: "10", // Basil (dark green) – like Adomas's old lesson events
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] },
    extendedProperties: { private: { chalkLessonId: lesson.id } },
  };
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

/** Runs fn over items, at most `limit` at a time. */
async function inParallel<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
