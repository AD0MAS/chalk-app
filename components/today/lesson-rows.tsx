"use client";

import { BoardLink } from "@/components/lessons/board";
import { TruncatedText } from "@/components/truncated-text";
import type { LessonItem } from "@/lib/lessons/queries";
import { NOTES_START } from "@/lib/notes/constants";
import type { LessonContext } from "@/lib/notes/queries";
import { toneDot } from "@/lib/students/constants";
import { btn, card } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { GapChips } from "./focus-card";

// Šiandien rows – "Toliau šiandien", "Jau įvyko", "Atšaukta".

export function LessonRow({
  lesson,
  ctx,
  badge,
  onBoardMissing,
}: {
  lesson: LessonItem;
  ctx: LessonContext;
  badge: string | null; // "po 18 min" on the next lesson while another one runs
  onBoardMissing: () => void;
}) {
  return (
    <article className={cn(card, "grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-6 px-6 py-5 max-md:flex max-md:flex-col max-md:items-stretch max-md:gap-2.5 max-md:px-[18px] max-md:py-4")}>
      <div className="flex flex-col gap-1.5 max-md:hidden">
        <span className="font-serif text-[30px] leading-none tabular-nums">{lesson.time}</span>
        {badge && <span className="inline-flex h-[22px] items-center self-start rounded-pill bg-primary px-2 text-xs font-medium whitespace-nowrap text-primary-foreground">{badge}</span>}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-serif text-[22px] leading-none tabular-nums md:hidden">{lesson.time}</span>
          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-pill max-md:ml-1", toneDot(lesson.tone))} />
          <TruncatedText className="font-medium">{lesson.name}</TruncatedText>
          <span className="shrink-0 text-sm whitespace-nowrap text-muted-foreground max-md:text-[13px]">{lesson.grade}</span>
          {badge && (
            <span className="ml-auto inline-flex h-[22px] shrink-0 items-center rounded-pill bg-primary px-2 text-[11px] font-medium whitespace-nowrap text-primary-foreground md:hidden">
              {badge}
            </span>
          )}
        </div>
        <p className="font-serif text-[21px] leading-[1.25] tracking-[-0.01em] [overflow-wrap:anywhere] max-md:text-lg">
          <span className="font-sans text-[13px] font-medium tracking-[-0.2px] text-muted-foreground">Pradėti nuo · </span>
          {ctx.startFrom ?? <span className="text-muted-foreground">{ctx.hasEarlierNotes ? "neįrašyta" : "pirma pamoka – užrašų dar nėra"}</span>}
        </p>
        <GapChips gaps={ctx.gaps} small />
      </div>
      <div className="flex gap-1.5 max-md:[&>*]:flex-1">
        {lesson.meetUrl ? (
          <a href={lesson.meetUrl} target="_blank" rel="noopener noreferrer" className={btn.primary}>
            Prisijungti
          </a>
        ) : (
          <span aria-disabled="true" title="Meet nuoroda nenurodyta" className={cn(btn.primary, "opacity-40")}>
            Prisijungti
          </span>
        )}
        <BoardLink url={lesson.boardUrl} onMissing={onBoardMissing} className={btn.secondary}>
          Lenta
        </BoardLink>
      </div>
    </article>
  );
}

export function HeldRow({ lesson, ctx, onNotes }: { lesson: LessonItem; ctx: LessonContext; onNotes: () => void }) {
  const needsNotes = !ctx.hasNote && lesson.date >= NOTES_START;
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-pill border bg-card py-2.5 pr-2.5 pl-5 max-md:gap-2.5 max-md:pl-4">
      <span className="shrink-0 text-sm font-medium text-muted-foreground tabular-nums max-md:hidden">{lesson.time}</span>
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-pill", toneDot(lesson.tone))} />
      <span className="flex min-w-0 flex-1 items-center gap-3 max-md:flex-col max-md:items-start max-md:gap-0">
        <span className="flex min-w-0 max-w-full items-center gap-2">
          <TruncatedText className="font-medium">{lesson.name}</TruncatedText>
          <span className="shrink-0 text-[13px] text-muted-foreground max-md:hidden">{lesson.grade}</span>
          <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums md:hidden">· {lesson.time}</span>
        </span>
        <span className="flex shrink-0 gap-1.5 max-md:text-xs">
          <span className="inline-flex h-6 items-center rounded-pill bg-sage-tint px-2.5 text-[13px] font-medium text-sage-ink max-md:h-auto max-md:bg-transparent max-md:px-0 max-md:text-xs">Įvyko</span>
          {needsNotes && (
            <span className="inline-flex h-6 items-center rounded-pill bg-sand-tint px-2.5 text-[13px] font-medium text-sand-ink max-md:h-auto max-md:bg-transparent max-md:px-0 max-md:text-xs">
              <span className="md:hidden">·&nbsp;</span>Laukia užrašų
            </span>
          )}
        </span>
      </span>
      <button type="button" onClick={onNotes} className={cn(needsNotes ? btn.primary : btn.ghost, "ml-auto h-10 px-4 text-sm")}>
        {needsNotes ? (
          <>
            <span className="max-md:hidden">Rašyti užrašus</span>
            <span className="md:hidden">Rašyti</span>
          </>
        ) : (
          "Užrašai"
        )}
      </button>
    </div>
  );
}

export function CancelledRow({ lesson, onRestore }: { lesson: LessonItem; onRestore: () => void }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-pill border bg-card py-2.5 pr-2.5 pl-5 text-muted-foreground max-md:gap-2.5 max-md:pl-4">
      <span className="shrink-0 text-sm font-medium tabular-nums line-through">{lesson.time}</span>
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-pill opacity-50", toneDot(lesson.tone))} />
      <TruncatedText className="font-medium">{lesson.name}</TruncatedText>
      <span className="inline-flex h-6 shrink-0 items-center rounded-pill bg-coral-tint px-2.5 text-[13px] font-medium text-coral-ink">Atšaukta</span>
      <button type="button" onClick={onRestore} className={cn(btn.ghost, "ml-auto h-10 px-4 text-sm")}>
        Atkurti
      </button>
    </div>
  );
}
