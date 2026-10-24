"use client";

import { ChevronDown, FileText, Pencil, Video } from "lucide-react";
import Link from "next/link";
import { BoardLink } from "@/components/lessons/board";
import type { LessonItem } from "@/lib/lessons/queries";
import { addDays, formatDateLong, formatDayMonth, weekdayOf } from "@/lib/lessons/time";
import type { DatedNote, OpenGap } from "@/lib/notes/constants";
import type { LessonContext } from "@/lib/notes/queries";
import { toneDot, weekdayShort } from "@/lib/students/constants";
import { cn } from "@/lib/utils";

// The current / next lesson – the most important card on Šiandien (DESIGN.md §0.4: emphasis by
// elevation and type, not colour). "Pradėti nuo" is the most prominent text.

const LESSON_MS = 60 * 60_000;

/** "po 18 min", "po 2 val. 5 min" */
export function untilText(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `po ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `po ${h} val.${m ? ` ${m} min` : ""}`;
}

export function FocusCard({
  lesson,
  ctx,
  now,
  today,
  onNotes,
  onBoardMissing,
}: {
  lesson: LessonItem;
  ctx: LessonContext;
  now: number;
  today: string;
  onNotes: () => void;
  onBoardMissing: () => void;
}) {
  const start = Date.parse(lesson.startsAt);
  const running = start <= now && now < start + LESSON_MS;
  const elapsed = Math.min(60, Math.max(0, Math.floor((now - start) / 60_000)));
  const when =
    lesson.date === today
      ? untilText(start - now)
      : lesson.date === addDays(today, 1)
        ? `rytoj ${lesson.time}`
        : `${formatDateLong(lesson.date)} ${lesson.time}`;

  return (
    <article
      aria-label={running ? "Dabartinė pamoka" : "Kita pamoka"}
      className="flex flex-wrap gap-8 rounded-hero border bg-card p-9 shadow-glass-hover max-md:gap-4 max-md:rounded-sheet max-md:p-[22px]"
    >
      <div className="flex min-w-0 flex-[3_1_420px] flex-col gap-5 max-md:gap-3.5">
        {running ? (
          <span className="inline-flex h-[30px] items-center gap-2 self-start rounded-pill bg-sage-tint px-3 text-[13px] font-medium whitespace-nowrap text-sage-ink">
            <span className="relative size-2">
              <span className="absolute inset-0 animate-ping rounded-pill bg-sage motion-reduce:animate-none" />
              <span className="absolute inset-0 rounded-pill bg-sage" />
            </span>
            Vyksta dabar · liko {60 - elapsed} min
          </span>
        ) : (
          <span className="inline-flex h-[30px] items-center self-start rounded-pill bg-muted px-3 text-[13px] font-medium whitespace-nowrap text-foreground/80 tabular-nums">
            Kita pamoka · {when}
          </span>
        )}

        <div className="flex min-w-0 items-center gap-3.5 max-md:flex-wrap max-md:items-baseline max-md:gap-x-2.5 max-md:gap-y-1">
          <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-pill max-md:hidden", toneDot(lesson.tone))} />
          <span title={lesson.fullName} className="clamp-2 min-w-0 font-serif text-[52px] leading-[1.2] tracking-[-0.03em] break-words! max-md:text-[32px]">
            {lesson.name}
          </span>
          <span className="shrink-0 whitespace-nowrap text-muted-foreground tabular-nums max-md:text-sm">
            {lesson.grade} · {lesson.time}–{lesson.endTime}
          </span>
        </div>

        {running && (
          <div role="progressbar" aria-label="Pamokos eiga" aria-valuenow={elapsed} aria-valuemin={0} aria-valuemax={60} className="h-1 overflow-hidden rounded-pill bg-foreground/[.07]">
            <div className="h-full rounded-pill bg-foreground transition-[width] duration-500" style={{ width: `${(elapsed / 60) * 100}%` }} />
          </div>
        )}

        <div className="flex flex-col gap-2 max-md:gap-1">
          <span className="text-[13px] font-medium text-muted-foreground max-md:text-xs">Pradėti nuo</span>
          {ctx.startFrom ? (
            <p className="font-serif text-4xl leading-[1.15] tracking-[-0.02em] whitespace-pre-line [overflow-wrap:anywhere] max-md:text-2xl max-md:leading-[1.2]">{ctx.startFrom}</p>
          ) : (
            <p className="font-serif text-[28px] leading-[1.15] tracking-[-0.02em] text-muted-foreground max-md:text-[22px]">
              {ctx.hasEarlierNotes ? "Praėjusį kartą neįrašyta" : "Pirma pamoka – užrašų dar nėra"}
            </p>
          )}
        </div>

        <GapChips gaps={ctx.gaps} />

        <div className="flex flex-wrap gap-2.5 max-md:grid max-md:grid-cols-[1.4fr_1fr_1fr] max-md:gap-1.5">
          {lesson.meetUrl ? (
            <a href={lesson.meetUrl} target="_blank" rel="noopener noreferrer" className={cn(big, "bg-primary px-6 text-primary-foreground shadow-button hover:opacity-90")}>
              <Video aria-hidden="true" className="size-5 max-md:hidden" strokeWidth={1.75} />
              Prisijungti
            </a>
          ) : (
            <span aria-disabled="true" title="Meet nuoroda nenurodyta" className={cn(big, "bg-primary px-6 text-primary-foreground opacity-40")}>
              <Video aria-hidden="true" className="size-5 max-md:hidden" strokeWidth={1.75} />
              Prisijungti
            </span>
          )}
          <BoardLink url={lesson.boardUrl} onMissing={onBoardMissing} className={cn(big, secondary)}>
            <Pencil aria-hidden="true" className="size-5 max-md:hidden" strokeWidth={1.75} />
            Lenta
          </BoardLink>
          <button type="button" onClick={onNotes} className={cn(big, secondary)}>
            <FileText aria-hidden="true" className="size-5 max-md:hidden" strokeWidth={1.75} />
            Užrašai
          </button>
        </div>
      </div>

      {/* Praėjusi pamoka – side panel on desktop, collapsible on phone */}
      <aside className="flex min-w-0 flex-[2_1_300px] flex-col gap-4 rounded-card border bg-background p-6 max-md:hidden">
        <PreviousLesson note={ctx.previous} studentId={lesson.studentId} />
      </aside>
      <details className="group w-full rounded-tile border bg-background px-3.5 py-3 md:hidden">
        <summary className="flex min-h-[22px] cursor-pointer list-none items-center text-sm font-medium [&::-webkit-details-marker]:hidden">
          Praėjusi pamoka{ctx.previous ? ` · ${weekdayShort(weekdayOf(ctx.previous.date)).toLocaleLowerCase("lt")}.` : ""}
          <ChevronDown aria-hidden="true" className="ml-auto size-4 transition-transform group-open:rotate-180" strokeWidth={2} />
        </summary>
        <div className="flex flex-col gap-3 pt-3">
          <PreviousLesson note={ctx.previous} studentId={lesson.studentId} compact />
        </div>
      </details>
    </article>
  );
}

const big = "inline-flex h-12 items-center justify-center gap-2.5 rounded-pill text-base font-medium whitespace-nowrap transition-all duration-200 outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground/40 max-md:h-11 max-md:px-2 max-md:text-sm";
const secondary = "bg-card px-[22px] text-foreground shadow-[inset_0_0_0_1px_var(--input)] hover:bg-background";

function PreviousLesson({ note, studentId, compact }: { note: DatedNote | null; studentId: string; compact?: boolean }) {
  return (
    <>
      {!compact && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium whitespace-nowrap">Praėjusi pamoka</span>
          {note && (
            <span className="text-[13px] whitespace-nowrap text-muted-foreground">
              {weekdayShort(weekdayOf(note.date)).toLocaleLowerCase("lt")}., {formatDayMonth(note.date)}
            </span>
          )}
        </div>
      )}
      {note ? (
        <>
          <NoteLine label="Ką darėm" text={note.done} />
          <NoteLine label="Kur baigėm" text={note.stoppedAt} />
          <NoteLine label="ND" text={note.homework} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Pirma pamoka – užrašų dar nėra.</p>
      )}
      <Link href={`/mokiniai/${studentId}?skirtukas=uzrasai`} className="mt-auto w-fit text-sm font-medium hover:underline">
        Visi mokinio užrašai →
      </Link>
    </>
  );
}

function NoteLine({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={cn("whitespace-pre-line [overflow-wrap:anywhere]", !text && "text-muted-foreground")}>{text || "–"}</span>
    </div>
  );
}

/** Open gaps as small chips (DESIGN.md §0.3: colour only as a small dot). */
export function GapChips({ gaps, small }: { gaps: OpenGap[]; small?: boolean }) {
  if (gaps.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {gaps.map((g) => (
        <span
          key={g.id}
          title={g.text}
          className={cn(
            "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-pill bg-card text-[13px] shadow-[inset_0_0_0_1px_var(--input)]",
            small ? "h-[26px] px-2.5" : "h-7 px-3 font-medium"
          )}
        >
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-pill bg-clay" />
          <span className="truncate-name">{g.text}</span>
        </span>
      ))}
    </div>
  );
}
