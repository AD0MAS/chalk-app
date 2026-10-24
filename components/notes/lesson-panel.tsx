"use client";

import { CalendarClock, Check, CircleX, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LESSON_STATUS } from "@/lib/lessons/constants";
import type { LessonItem } from "@/lib/lessons/queries";
import { formatDateLong, formatDayMonth, weekdayOf } from "@/lib/lessons/time";
import { addPanelGap, loadLessonPanel, resolvePanelGap } from "@/lib/notes/actions";
import type { DatedNote, OpenGap } from "@/lib/notes/constants";
import type { LessonPanelData } from "@/lib/notes/queries";
import { formatEur, toneDot, weekdayLong, weekdayShort } from "@/lib/students/constants";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { NotesForm, type NotesFormHandle } from "./notes-form";

// SPEC §3 screen 2 – "Pamoka": left the student's last 3 notes + open gaps (add / resolve inline),
// right the 4-field notes form with autosave. Actions: Perkelti, Atšaukti.
// Used as a dialog from any lesson (LessonPanelDialog) and as the page /pamokos/[id].

export type PanelActions = {
  onMove: (lesson: LessonItem) => void;
  onCancel: (lesson: LessonItem) => void;
  onRestore: (lesson: LessonItem) => void;
};

export function LessonPanelView({
  data,
  inDialog,
  formRef,
  onChanged,
  actions,
}: {
  data: LessonPanelData;
  inDialog: boolean;
  formRef?: React.Ref<NotesFormHandle>;
  onChanged: () => void;
  actions: PanelActions;
}) {
  const { lesson, today } = data;
  const cancelled = lesson.status === "atsaukta";
  const Title = inDialog ? DialogTitle : "h1";
  const Description = inDialog ? DialogDescription : "p";
  const fullDate = `${weekdayLong(weekdayOf(lesson.date))}, ${formatDayMonth(lesson.date)}`;
  const hint = data.nextLesson
    ? `Bus rodoma Šiandien prieš kitą pamoką – ${formatDateLong(data.nextLesson.date)} ${data.nextLesson.time}`
    : "Bus rodoma Šiandien prieš kitą pamoką";

  return (
    <div className="flex min-w-0 flex-col">
      <header className={cn("flex flex-wrap items-center gap-3.5 border-b border-border/70 pb-5", inDialog && "pr-12")}>
        <span className="relative flex size-12 shrink-0 items-center justify-center rounded-pill border bg-card font-serif text-[22px]">
          {lesson.name.trim()[0]?.toLocaleUpperCase("lt")}
          <span aria-hidden="true" className={cn("absolute right-0 bottom-0.5 size-3 rounded-pill ring-2 ring-card", toneDot(lesson.tone))} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-baseline gap-2.5">
            <Title title={lesson.fullName} className="truncate-name font-serif text-[32px] leading-[1.05] font-normal tracking-[-0.03em] max-sm:text-[26px]">
              {lesson.name}
            </Title>
            <span className="shrink-0 text-[15px] whitespace-nowrap text-muted-foreground">{lesson.grade}</span>
            <span className={cn("inline-flex h-[26px] shrink-0 items-center self-center rounded-pill px-2.5 text-[13px] font-medium", LESSON_STATUS[lesson.status].pill)}>
              {LESSON_STATUS[lesson.status].label}
            </span>
          </div>
          <Description className="text-sm text-muted-foreground tabular-nums">
            {fullDate} · {lesson.time}–{lesson.endTime} · {formatEur(lesson.price)}
            {lesson.original && ` · perkelta iš ${weekdayShort(weekdayOf(lesson.original.date))} ${lesson.original.time}`}
          </Description>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 max-sm:w-full">
          {cancelled ? (
            <button type="button" onClick={() => actions.onRestore(lesson)} className={btn.secondary}>
              <RotateCcw aria-hidden="true" className="size-4" strokeWidth={1.75} />
              Atkurti
            </button>
          ) : (
            <>
              <button type="button" onClick={() => actions.onMove(lesson)} className={btn.secondary}>
                <CalendarClock aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
                Perkelti
              </button>
              <button type="button" onClick={() => actions.onCancel(lesson)} className={btn.danger}>
                <CircleX aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
                Atšaukti pamoką
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-6 pt-6 max-sm:gap-5">
        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">Paskutiniai užrašai</h3>
          {data.previous.length === 0 ? (
            <p className="rounded-card border bg-card px-4 py-3.5 text-sm text-muted-foreground">Pirma pamoka – užrašų dar nėra.</p>
          ) : (
            data.previous.map((note, i) => <PreviousNote key={note.lessonId} note={note} today={today} first={i === 0} />)
          )}
          <Link href={`/mokiniai/${lesson.studentId}?skirtukas=uzrasai`} className="w-fit text-sm font-medium hover:underline">
            Visi mokinio užrašai →
          </Link>

          <h3 className="mt-2.5 text-sm font-medium text-muted-foreground">Atviros spragos</h3>
          <PanelGaps studentId={lesson.studentId} initial={data.gaps} onChanged={onChanged} />
        </aside>

        <NotesForm
          ref={formRef}
          lessonId={lesson.id}
          initial={data.note}
          disabled={cancelled}
          hint={cancelled ? "Pamoka atšaukta – užrašų nereikia." : hint}
          onSaved={onChanged}
        />
      </div>
    </div>
  );
}

function daysAgo(date: string, today: string) {
  const days = Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000);
  if (days === 0) return "šiandien";
  if (days === 1) return "vakar";
  if (days < 0) return days === -1 ? "rytoj" : `po ${-days} d.`;
  return `prieš ${days} d.`;
}

function PreviousNote({ note, today, first }: { note: DatedNote; today: string; first: boolean }) {
  return (
    <article className={cn("flex flex-col gap-2 rounded-card border bg-card p-4", first && "shadow-card")}>
      <div className="flex justify-between gap-2 text-[13px]">
        <span className="font-medium">
          {weekdayShort(weekdayOf(note.date))}, {formatDayMonth(note.date)}
        </span>
        <span className="shrink-0 text-muted-foreground">{daysAgo(note.date, today)}</span>
      </div>
      {note.done && <p className="text-sm leading-[19px] whitespace-pre-line [overflow-wrap:anywhere]">{note.done}</p>}
      {note.stoppedAt && (
        <p className="text-[13px] leading-[18px] text-foreground/80 [overflow-wrap:anywhere]">
          <b className="font-medium">Kur baigėm:</b> {note.stoppedAt}
        </p>
      )}
      {note.homework && (
        <p className="text-[13px] leading-[18px] text-foreground/80 [overflow-wrap:anywhere]">
          <b className="font-medium">ND:</b> {note.homework}
        </p>
      )}
      {first && note.nextStart && (
        <p className="border-t border-border/70 pt-2 font-serif text-base leading-[21px] [overflow-wrap:anywhere]">
          <span className="font-sans text-xs font-medium text-muted-foreground">Pradėti nuo · </span>
          {note.nextStart}
        </p>
      )}
    </article>
  );
}

/** Open gaps as chips: ✓ resolves one, "+ Spraga" adds one. */
function PanelGaps({ studentId, initial, onChanged }: { studentId: string; initial: OpenGap[]; onChanged: () => void }) {
  const [gaps, setGaps] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => ReturnType<typeof addPanelGap>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return setError(result.message);
      setGaps(result.gaps);
      onChanged();
      after?.();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={cn("flex flex-wrap gap-2", pending && "opacity-60")}>
        {gaps.length === 0 && !adding && <span className="self-center text-sm text-muted-foreground">Atvirų spragų nėra.</span>}
        {gaps.map((g) => (
          <span key={g.id} className="inline-flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-pill bg-card pr-1.5 pl-3 text-[13px] font-medium shadow-[inset_0_0_0_1px_var(--input)]">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-pill bg-clay" />
            <span title={g.text} className="truncate-name">
              {g.text}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => resolvePanelGap(studentId, g.id))}
              aria-label={`Pažymėti „${g.text}“ kaip išspręstą`}
              title="Išspręsta"
              className="flex size-[22px] shrink-0 items-center justify-center rounded-pill bg-muted text-foreground/80 transition-colors hover:bg-sage-tint hover:text-sage-ink"
            >
              <Check aria-hidden="true" className="size-3" strokeWidth={2.5} />
            </button>
          </span>
        ))}
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-8 items-center gap-1 rounded-pill px-3 text-[13px] font-medium text-foreground/80 shadow-[inset_0_0_0_1px_var(--input)] transition-colors hover:bg-card"
          >
            <Plus aria-hidden="true" className="size-3.5" strokeWidth={2} />
            Spraga
          </button>
        )}
      </div>
      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => addPanelGap(studentId, text),
              () => setText("")
            );
          }}
          className="flex gap-1.5"
        >
          <label htmlFor="panel-gap" className="sr-only">
            Nauja spraga
          </label>
          <input
            id="panel-gap"
            autoFocus
            maxLength={200}
            autoComplete="off"
            placeholder="pvz. Lygtys"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && text === "") {
                e.stopPropagation();
                setAdding(false);
              }
            }}
            className="h-9 w-full min-w-0 rounded-pill bg-card px-3.5 text-sm shadow-[inset_0_0_0_1px_var(--input)] outline-none focus:shadow-[inset_0_0_0_1px_rgba(3,3,2,.3),0_0_0_3px_rgba(3,3,2,.08)]"
          />
          <button type="submit" disabled={pending || !text.trim()} className={btn.small}>
            Pridėti
          </button>
          <button type="button" onClick={() => setAdding(false)} className={cn(btn.ghost, "h-9 px-3 text-sm")}>
            Baigti
          </button>
        </form>
      )}
      {error && <span className="text-[13px] text-coral-ink">{error}</span>}
    </div>
  );
}

/* ---------------- as a dialog ---------------- */

/**
 * Opened from any lesson. Loads its data when opened; before closing it saves anything unsaved,
 * then tells the caller whether something changed (so the page behind can refresh once).
 */
export function LessonPanelDialog({
  lessonId,
  onClose,
  actions,
}: {
  lessonId: string | null; // null = closed
  onClose: (changed: boolean) => void;
  actions: PanelActions;
}) {
  const [loaded, setLoaded] = useState<{ id: string; data: LessonPanelData | null } | null>(null);
  const formRef = useRef<NotesFormHandle>(null);
  const changed = useRef(false);

  useEffect(() => {
    if (!lessonId) return;
    let current = true;
    changed.current = false;
    loadLessonPanel(lessonId)
      .then((data) => current && setLoaded({ id: lessonId, data }))
      .catch(() => current && setLoaded({ id: lessonId, data: null }));
    return () => {
      current = false;
    };
  }, [lessonId]);

  const markChanged = useCallback(() => {
    changed.current = true;
  }, []);

  async function close() {
    const saved = (await formRef.current?.flush()) ?? true;
    if (!saved && !window.confirm("Užrašų nepavyko išsaugoti. Uždaryti vis tiek?")) return;
    onClose(changed.current);
  }

  // Perkelti / Atšaukti / Atkurti: save first, then hand over to the other dialog.
  async function handOver(fn: (lesson: LessonItem) => void, lesson: LessonItem) {
    await formRef.current?.flush();
    onClose(changed.current);
    fn(lesson);
  }

  const data = loaded?.id === lessonId ? loaded.data : undefined;

  return (
    <Dialog open={lessonId !== null} onOpenChange={(open) => !open && void close()}>
      <DialogContent className="top-4 [background:var(--panel-gradient)] max-h-[calc(100dvh-2rem)] translate-y-0 p-7 sm:max-w-[1040px] max-sm:top-2 max-sm:max-h-[calc(100dvh-1rem)] max-sm:p-4">
        {data === undefined && <PanelSkeleton />}
        {data === null && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <DialogTitle className="text-[22px]">Pamoka nerasta</DialogTitle>
            <DialogDescription>Gal ji ką tik buvo ištrinta. Atnaujink puslapį.</DialogDescription>
          </div>
        )}
        {data && (
          <LessonPanelView
            key={data.lesson.id}
            data={data}
            inDialog
            formRef={formRef}
            onChanged={markChanged}
            actions={{
              onMove: (lesson) => void handOver(actions.onMove, lesson),
              onCancel: (lesson) => void handOver(actions.onCancel, lesson),
              onRestore: (lesson) => void handOver(actions.onRestore, lesson),
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Įkeliama">
      <DialogTitle className="sr-only">Įkeliama pamoka</DialogTitle>
      <DialogDescription className="sr-only">Užrašai ir spragos kraunasi</DialogDescription>
      <div className="flex items-center gap-3.5">
        <div className="size-12 animate-pulse rounded-pill bg-muted" />
        <div className="flex flex-col gap-2">
          <div className="h-7 w-48 animate-pulse rounded-pill bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded-pill bg-muted" />
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="h-72 flex-[1_1_300px] animate-pulse rounded-card bg-muted" />
        <div className="h-96 flex-[2_1_480px] animate-pulse rounded-card bg-muted" />
      </div>
    </div>
  );
}
