"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getDayLessons, moveLesson } from "@/lib/lessons/actions";
import type { LessonItem } from "@/lib/lessons/queries";
import {
  addDays,
  capitalize,
  formatDateLong,
  formatDayMonth,
  formatWeekRange,
  mondayOf,
  todayVilnius,
  vilniusParts,
  weekdayAbbr,
  weekdayGenitive,
  weekdayOf,
} from "@/lib/lessons/time";
import { toneDot, weekdayShort } from "@/lib/students/constants";
import { btn, field, segment } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { CalendarNote, ConflictWarning, DayPreview, overlapping } from "./day-preview";

// SPEC §3 screen 3 – "Perkelti pamoką": Tik šią pamoką / Nuo dabar visam laikui,
// date + time, that day's other lessons and an overlap warning (moving is still allowed).

export type MovePreset = { date: string; time: string };

export function MoveDialog({
  lesson,
  preset,
  onOpenChange,
  onSaved,
}: {
  lesson: LessonItem | null; // null = closed
  preset?: MovePreset; // from drag & drop in Tvarkaraštis
  onOpenChange: (open: boolean) => void;
  onSaved?: (message: string) => void;
}) {
  return (
    <Dialog open={lesson !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        {lesson && (
          <MoveForm
            key={`${lesson.id}-${preset?.date}-${preset?.time}`}
            lesson={lesson}
            preset={preset}
            onDone={(message) => {
              onOpenChange(false);
              onSaved?.(message);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MoveForm({ lesson, preset, onDone }: { lesson: LessonItem; preset?: MovePreset; onDone: (message: string) => void }) {
  const today = todayVilnius();
  const canSeries = lesson.kind === "regular" && lesson.slotId !== null && lesson.isFuture && lesson.status === "suplanuota";

  const [mode, setMode] = useState<"once" | "series">("once");
  const [date, setDate] = useState(() => {
    const d = preset?.date ?? lesson.date;
    return d < today ? today : d;
  });
  const [time, setTime] = useState(preset?.time ?? lesson.time);
  const [monday, setMonday] = useState(() => mondayOf(date));
  const [day, setDay] = useState<{ date: string; lessons: LessonItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // That day's other lessons, for the preview and the overlap warning.
  useEffect(() => {
    let current = true;
    getDayLessons(date)
      .then((lessons) => current && setDay({ date, lessons: lessons.filter((l) => l.id !== lesson.id) }))
      .catch(() => current && setDay({ date, lessons: [] }));
    return () => {
      current = false;
    };
  }, [date, lesson.id]);

  const dayLessons = day?.date === date ? day.lessons : [];
  const conflicts = time ? overlapping(dayLessons, time) : [];
  const unchanged = date === lesson.date && time === lesson.time;
  const nowTime = vilniusParts(new Date()).time;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await moveLesson(lesson.id, date, time, mode);
      if (result.ok) onDone(mode === "series" ? `Laikas pakeistas visam laikui: ${weekdayAbbr(date)} ${time}` : `Pamoka perkelta į ${weekdayAbbr(date)} ${time}`);
      else setError(result.message);
    });
  }

  return (
    <>
      <DialogHeader className="pr-12">
        <DialogTitle>Perkelti pamoką</DialogTitle>
        {/* Phone: "dabar …" gets its own line – it doesn't fit beside the name and the close button */}
        <DialogDescription className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
          <span className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-pill", toneDot(lesson.tone))} />
            <span className="truncate-name">{lesson.name}</span>
            <span className="shrink-0 whitespace-nowrap">· {lesson.grade}</span>
          </span>
          <span className="shrink-0 whitespace-nowrap max-sm:basis-full">
            <span className="max-sm:hidden">· </span>dabar {formatDateLong(lesson.date)} {lesson.time}
          </span>
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        {/* Phone: two equal halves are too narrow for "Nuo dabar visam laikui" – each label gets its own width */}
        <div role="radiogroup" aria-label="Ką perkelti" className={cn(segment, "grid grid-cols-2 max-sm:grid-cols-[auto_minmax(0,1fr)]")}>
          {(
            [
              ["once", "Tik šią pamoką"],
              ["series", "Nuo dabar visam laikui"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              disabled={value === "series" && !canSeries}
              title={value === "series" && !canSeries ? "Tik būsimai savaitinei pamokai" : undefined}
              onClick={() => setMode(value)}
              className={cn(
                "h-10 rounded-pill px-3 text-[15px] font-medium whitespace-nowrap transition-all max-sm:h-auto max-sm:min-h-10 max-sm:px-2 max-sm:py-1 max-sm:text-[14px] max-sm:leading-[18px] max-sm:whitespace-normal duration-200 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-foreground/40",
                mode === value ? "bg-card text-foreground shadow-button" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {text}
            </button>
          ))}
        </div>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          {mode === "series"
            ? `Nuo ${formatDayMonth(date)} savaitinis laikas keičiasi: ${weekdayShort(weekdayOf(lesson.date))} ${lesson.time} → ${weekdayShort(weekdayOf(date))} ${time}. Praėjusios, atšauktos ir atskirai perkeltos pamokos nesikeičia.`
            : lesson.kind === "one_off"
              ? "Vienkartinė pamoka perkeliama į naują laiką."
              : `Perkeliama tik ši pamoka. Kitos ${weekdayGenitive(lesson.date)} pamokos lieka ${lesson.time}, o originalus laikas išsaugomas.`}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Nauja data</span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Ankstesnė savaitė"
              disabled={monday <= mondayOf(today)}
              onClick={() => setMonday(addDays(monday, -7))}
              className={cn(btn.ghost, "size-8 px-0 disabled:opacity-30")}
            >
              <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={2} />
            </button>
            <span className="text-[13px] text-muted-foreground tabular-nums">{formatWeekRange(monday)}</span>
            <button type="button" aria-label="Kita savaitė" onClick={() => setMonday(addDays(monday, 7))} className={cn(btn.ghost, "size-8 px-0")}>
              <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2} />
            </button>
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((d) => {
            const selected = d === date;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={selected}
                disabled={d < today}
                onClick={() => setDate(d)}
                aria-label={`${capitalize(formatDateLong(d))}${d === lesson.date ? " (dabartinė data)" : ""}`}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-tile transition-colors duration-150 disabled:text-muted-foreground/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40",
                  selected ? "bg-primary text-primary-foreground" : "bg-card shadow-[inset_0_0_0_1px_var(--border)] enabled:hover:bg-background disabled:bg-transparent disabled:shadow-none"
                )}
              >
                <span className={cn("text-xs", !selected && "text-muted-foreground")}>{weekdayShort(weekdayOf(d))}</span>
                <span className="text-base font-medium tabular-nums">{Number(d.slice(8, 10))}</span>
                {d === lesson.date && !selected && (
                  <span aria-hidden="true" className={cn("absolute bottom-1.5 size-1 rounded-pill", toneDot(lesson.tone))} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <label htmlFor="move-time" className="text-sm font-medium">
          Naujas laikas
        </label>
        <div
          className={cn(
            field,
            "flex items-center gap-2.5 focus-within:shadow-[inset_0_0_0_1px_rgba(3,3,2,.3),0_0_0_3px_rgba(3,3,2,.08)] sm:max-w-[244px]",
            conflicts.length > 0 && "shadow-[inset_0_0_0_2px_var(--sand)]"
          )}
        >
          <input
            id="move-time"
            type="time"
            step={300}
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-lg font-medium tabular-nums outline-none"
          />
          <span className="shrink-0 text-[13px] text-muted-foreground">60 min</span>
        </div>
        <DayPreview
          lessons={dayLessons}
          time={time || lesson.time}
          candidate={{ name: lesson.name, tone: lesson.tone }}
          label={`${capitalize(weekdayGenitive(date))} pamokos`}
          onPickTime={setTime}
          loading={day?.date !== date}
          minTime={date === today ? nowTime : undefined}
        />
      </div>

      <ConflictWarning conflicts={conflicts} />
      <CalendarNote />
      {error && (
        <p role="alert" className="text-sm text-coral-ink">
          {error}
        </p>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <button type="button" className={btn.ghost}>
            Atšaukti
          </button>
        </DialogClose>
        <button type="button" disabled={pending || !time || (unchanged && mode === "once")} onClick={submit} className={btn.primary}>
          {pending ? "Perkeliama…" : mode === "series" ? `Visam laikui: ${weekdayAbbr(date)} ${time}` : `Perkelti į ${weekdayAbbr(date)} ${time}`}
        </button>
      </DialogFooter>
    </>
  );
}
