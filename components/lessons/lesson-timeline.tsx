"use client";

import { LESSON_STATUS } from "@/lib/lessons/constants";
import type { LessonItem } from "@/lib/lessons/queries";
import { NOTE_LABELS, NOTES_START, type NoteFields } from "@/lib/notes/constants";
import { capitalize, formatDayMonth, weekdayOf } from "@/lib/lessons/time";
import { toneDot, weekdayShort } from "@/lib/students/constants";
import { btn, card } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { useLessonDialogs } from "./use-lesson-dialogs";

// Profile tab "Užrašai": the student's lessons by date with their notes. Upcoming first (soonest on top),
// then past ones (held or cancelled), newest first. Each held lesson shows its notes or "Rašyti užrašus".

const UPCOMING_SHOWN = 6;

export function LessonTimeline({ lessons, notes }: { lessons: LessonItem[]; notes: Record<string, NoteFields> }) {
  const { openMove, openCancel, openNotes, restore, restoring, dialogs } = useLessonDialogs();
  // `lessons` arrive newest first.
  const upcoming = lessons.filter((l) => l.isFuture).reverse();
  const history = lessons.filter((l) => !l.isFuture);

  const row = (lesson: LessonItem) => (
    <LessonRow
      key={lesson.id}
      lesson={lesson}
      note={notes[lesson.id] ?? null}
      restoring={restoring}
      onMove={() => openMove(lesson)}
      onCancel={() => openCancel(lesson)}
      onRestore={() => restore(lesson)}
      onNotes={() => openNotes(lesson)}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8">
      <section aria-labelledby="upcoming" className="flex flex-col gap-3">
        <h2 id="upcoming" className="text-center font-serif text-2xl leading-[1.1] tracking-[-0.02em]">
          Artimiausios pamokos
        </h2>
        {upcoming.length ? (
          <ol className="relative flex flex-col gap-2.5">{upcoming.slice(0, UPCOMING_SHOWN).map(row)}</ol>
        ) : (
          <p className="text-center text-sm text-muted-foreground">Suplanuotų pamokų nėra.</p>
        )}
        {upcoming.length > UPCOMING_SHOWN && (
          <p className="text-center text-[13px] text-muted-foreground">
            ir dar {upcoming.length - UPCOMING_SHOWN} – visos Tvarkaraštyje (generuojama iki kito mėnesio pabaigos)
          </p>
        )}
      </section>

      <section aria-labelledby="history" className="flex flex-col gap-3">
        <h2 id="history" className="text-center font-serif text-2xl leading-[1.1] tracking-[-0.02em]">
          Praėjusios pamokos
        </h2>
        {history.length ? (
          <ol className="flex flex-col gap-2.5">{history.map(row)}</ol>
        ) : (
          <p className="text-center text-sm text-muted-foreground">Dar nė vienos – pirmos pamokos skaičiuojamos nuo 2026-10-21.</p>
        )}
      </section>
      {dialogs}
    </div>
  );
}

function LessonRow({
  lesson,
  note,
  restoring,
  onMove,
  onCancel,
  onRestore,
  onNotes,
}: {
  lesson: LessonItem;
  note: NoteFields | null;
  restoring: boolean;
  onMove: () => void;
  onCancel: () => void;
  onRestore: () => void;
  onNotes: () => void;
}) {
  const cancelled = lesson.status === "atsaukta";
  const needsNotes = lesson.status === "ivyko" && !note;
  return (
    <li className="grid grid-cols-[96px_28px_minmax(0,1fr)] items-start max-sm:grid-cols-[76px_20px_minmax(0,1fr)]">
      <span className="flex flex-col items-end pt-3.5 text-right">
        <span className="text-sm font-medium whitespace-nowrap">{capitalize(formatDayMonth(lesson.date).replace(" d.", ""))}</span>
        <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {weekdayShort(weekdayOf(lesson.date))} · {lesson.time}
        </span>
      </span>
      <span className="flex justify-center pt-[19px]">
        <span
          aria-hidden="true"
          className={cn(
            "size-[9px] rounded-pill shadow-[0_0_0_4px_var(--background)]",
            cancelled ? "bg-coral" : lesson.status === "ivyko" ? toneDot(lesson.tone) : "bg-card ring-1 ring-foreground/30"
          )}
        />
      </span>
      <div className={cn(card, "flex min-w-0 flex-col", cancelled && "shadow-none")}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <span className={cn("inline-flex h-6 shrink-0 items-center rounded-pill px-2.5 text-[13px] font-medium", LESSON_STATUS[lesson.status].pill)}>
            {LESSON_STATUS[lesson.status].label}
          </span>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            {lesson.kind === "one_off" && <span>Vienkartinė</span>}
            {lesson.original && (
              <span className="tabular-nums">
                Perkelta iš {weekdayShort(weekdayOf(lesson.original.date))} {formatDayMonth(lesson.original.date)} {lesson.original.time}
              </span>
            )}
            {cancelled && lesson.cancelReason && <span className="[overflow-wrap:anywhere]">{lesson.cancelReason} · nemokama</span>}
            {cancelled && !lesson.cancelReason && <span>nemokama</span>}
            {needsNotes && lesson.date >= NOTES_START && <span className="font-medium text-sand-ink">Laukia užrašų</span>}
            {needsNotes && lesson.date < NOTES_START && <span>Užrašų nėra</span>}
          </span>
          <span className="ml-auto flex shrink-0 flex-wrap justify-end gap-0.5">
            {cancelled ? (
              <button type="button" disabled={restoring} onClick={onRestore} className={cn(btn.ghost, "h-8 px-2.5 text-[13px]")}>
                Atkurti
              </button>
            ) : (
              <>
                {needsNotes ? (
                  <button type="button" onClick={onNotes} className={cn(btn.primary, "mr-1 h-8 px-3 text-[13px]")}>
                    Rašyti užrašus
                  </button>
                ) : (
                  <button type="button" onClick={onNotes} className={cn(btn.ghost, "h-8 px-2.5 text-[13px]")}>
                    {note ? "Redaguoti" : "Užrašai"}
                  </button>
                )}
                <button type="button" onClick={onMove} className={cn(btn.ghost, "h-8 px-2.5 text-[13px]")}>
                  Perkelti
                </button>
                <button type="button" onClick={onCancel} className={cn(btn.danger, "h-8 px-2.5 text-[13px]")}>
                  Atšaukti
                </button>
              </>
            )}
          </span>
        </div>
        {note && <NoteBody note={note} />}
      </div>
    </li>
  );
}

/** The 4 fields of a saved note (canvas: ProfilisUzrasai). Empty fields are left out. */
function NoteBody({ note }: { note: NoteFields }) {
  const item = (key: keyof NoteFields, className?: string) =>
    note[key].trim() ? (
      <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
        <span className="text-xs font-medium text-muted-foreground">{NOTE_LABELS[key]}</span>
        <span className="whitespace-pre-line [overflow-wrap:anywhere]">{note[key]}</span>
      </div>
    ) : null;
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-3 border-t border-border/70 px-5 pt-3.5 pb-[18px] max-sm:grid-cols-1 max-sm:px-4">
      {item("done", "col-span-2 max-sm:col-span-1")}
      {item("stoppedAt", "text-[15px]")}
      {item("homework", "text-[15px]")}
      {note.nextStart.trim() && (
        <div className="col-span-2 flex flex-col gap-0.5 border-t border-border/70 pt-3 max-sm:col-span-1">
          <span className="text-xs font-medium text-muted-foreground">{NOTE_LABELS.nextStart}</span>
          <span className="font-serif text-[19px] leading-[1.3] whitespace-pre-line [overflow-wrap:anywhere]">{note.nextStart}</span>
        </div>
      )}
    </div>
  );
}
