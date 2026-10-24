"use client";

import { layoutDay, LessonBlock, type BlockActions } from "@/components/lessons/lesson-block";
import { LessonPopoverGroup } from "@/components/lessons/popover-group";
import type { LessonItem } from "@/lib/lessons/queries";
import { fromMinutes, vilniusParts } from "@/lib/lessons/time";
import { cn } from "@/lib/utils";

// SPEC §3 screen 1 – day strip with a "dabar" line. Only today's Chalk lessons, nothing else.
// Desktop (DayStrip): 08–22, blocks adapt to their width (DESIGN.md §9).
// Phone (PhoneDayStrip): fits the card width without scrolling, fixed 08–24; every lesson is a small
// square in the student's tone (one hour wide, height = width), tap → the same popover.
// Each strip is its own popover group (both strips render the same lessons; one is hidden by CSS).

type StripProps = {
  lessons: LessonItem[];
  now: number;
  today: string;
  currentId: string | null;
  actions: (lesson: LessonItem) => BlockActions;
  className?: string;
};

export function DayStrip({ lessons, now, today, currentId, actions, className }: StripProps) {
  // 08–22, widened if a lesson falls outside.
  const startHour = Math.max(0, Math.min(8, ...lessons.map((l) => Math.floor(l.minutes / 60))));
  const endHour = Math.min(24, Math.max(22, ...lessons.map((l) => Math.ceil((l.minutes + 60) / 60))));
  const hours = endHour - startHour;
  const pct = (minutes: number) => ((minutes - startHour * 60) / (hours * 60)) * 100;

  const nowParts = vilniusParts(new Date(now));
  const showNow = nowParts.date === today && nowParts.minutes >= startHour * 60 && nowParts.minutes <= endHour * 60;
  const labels = Array.from({ length: hours + 1 }, (_, i) => startHour + i).filter((h) => h % 2 === 0);

  return (
    <section aria-label="Dienos juosta" className={cn("relative z-[3] rounded-card border bg-card px-6 pt-1 pb-3.5 shadow-card", className)}>
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="relative w-full pt-8">
          <div className="relative h-14">
            <HourLines hours={hours} />
            {lessons.length === 0 && <NoLessons />}
            <LessonPopoverGroup>
              {layoutDay(lessons).map(({ lesson, lane, lanes }) => {
                const inset = lesson.id === currentId ? 1 : 5;
                return (
                  <LessonBlock
                    key={lesson.id}
                    lesson={lesson}
                    highlight={lesson.id === currentId}
                    style={{
                      left: `calc(${pct(lesson.minutes)}% + 2px)`,
                      width: `calc(${100 / hours}% - 4px)`,
                      top: `calc(${(lane / lanes) * 100}% + ${inset}px)`,
                      height: `calc(${100 / lanes}% - ${inset * 2}px)`,
                      zIndex: lesson.id === currentId ? 2 : undefined,
                    }}
                    actions={actions(lesson)}
                  />
                );
              })}
            </LessonPopoverGroup>
            {showNow && <NowLine time={nowParts.time} left={pct(nowParts.minutes)} />}
          </div>
          <HourLabels labels={labels} startHour={startHour} endHour={endHour} pct={pct} className="mt-2 text-xs" />
        </div>
      </div>
    </section>
  );
}

const INSET = 2; // px around a phone square; the current lesson's square is bigger instead (CURRENT_GROW on each side)
const CURRENT_GROW = 3;
const TAP = 44; // px – minimum tap target; smaller squares get an invisible area around them

export function PhoneDayStrip({ lessons, now, today, currentId, actions, className }: StripProps) {
  // 08–24, starting earlier only if a lesson does.
  const startHour = Math.max(0, Math.min(8, ...lessons.map((l) => Math.floor(l.minutes / 60))));
  const endHour = 24;
  const hours = endHour - startHour;
  const pct = (minutes: number) => ((minutes - startHour * 60) / (hours * 60)) * 100;

  const nowParts = vilniusParts(new Date(now));
  const showNow = nowParts.date === today && nowParts.minutes >= startHour * 60;
  const labels = Array.from({ length: hours + 1 }, (_, i) => startHour + i).filter((h) => h % 4 === 0);

  // --hw = one hour's width in px (globals.css .phone-strip). Overlapping lessons stack in rows of --hw.
  const placed = layoutDay(lessons);
  const rows = Math.max(1, ...placed.map((p) => p.lanes));
  const hw = "var(--hw)";

  // Tap area: grows to 44 px, but only halfway towards a neighbour (same row) or the next row.
  const grow = `max(0px, (${TAP + 2 * INSET}px - ${hw}) / 2)`;
  const towards = (gapMinutes: number | null) =>
    gapMinutes === null ? grow : `min(${grow}, ${hw} * ${gapMinutes / 120} + ${INSET}px)`;
  function hitArea(lesson: LessonItem, lane: number, lanes: number): React.CSSProperties {
    const row = placed.filter((p) => p.lane === lane && p.lesson !== lesson);
    const before = row.filter((p) => p.lesson.minutes + 60 <= lesson.minutes).map((p) => lesson.minutes - p.lesson.minutes - 60);
    const after = row.filter((p) => p.lesson.minutes >= lesson.minutes + 60).map((p) => p.lesson.minutes - lesson.minutes - 60);
    return {
      left: `calc(-1 * ${towards(before.length ? Math.min(...before) : null)})`,
      right: `calc(-1 * ${towards(after.length ? Math.min(...after) : null)})`,
      top: `calc(-1 * ${lane === 0 ? grow : `${INSET}px`})`,
      bottom: `calc(-1 * ${lane === lanes - 1 ? grow : `${INSET}px`})`,
    };
  }

  return (
    <section aria-label="Dienos juosta" className={cn("relative z-[3] rounded-card border bg-card px-3 pt-1 pb-2.5 shadow-card", className)}>
      <div className="@container relative pt-7">
        <div
          className="phone-strip relative"
          style={{ "--hours": hours, height: `max(36px, ${rows} * ${hw} + 12px)` } as React.CSSProperties}
        >
          <HourLines hours={hours} />
          {lessons.length === 0 && <NoLessons />}
          <LessonPopoverGroup>
            {placed.map(({ lesson, lane, lanes }) => {
              const current = lesson.id === currentId;
              const inset = current && lanes === 1 ? -CURRENT_GROW : INSET; // overlapping: no room to grow
              return (
                <LessonBlock
                  key={lesson.id}
                  lesson={lesson}
                  highlight={current}
                  square={{ hitArea: hitArea(lesson, lane, lanes) }}
                  style={{
                    left: `calc(${hw} * ${(lesson.minutes - startHour * 60) / 60} + ${inset}px)`,
                    top: `calc(50% + ${hw} * ${lane - rows / 2} + ${inset}px)`,
                    width: `calc(${hw} - ${inset * 2}px)`,
                    height: `calc(${hw} - ${inset * 2}px)`,
                    zIndex: current ? 5 : undefined, // above the "dabar" line, which would hide most of it
                  }}
                  actions={actions(lesson)}
                />
              );
            })}
          </LessonPopoverGroup>
          {showNow && <NowLine time={nowParts.time} left={pct(nowParts.minutes)} keepInside />}
        </div>
        <HourLabels labels={labels} startHour={startHour} endHour={endHour} pct={pct} className="mt-1.5 text-[11px]" />
      </div>
    </section>
  );
}

function HourLines({ hours }: { hours: number }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 rounded-tile bg-background"
      style={{ backgroundImage: `repeating-linear-gradient(to right, var(--border) 0 1px, transparent 1px calc(100% / ${hours}))` }}
    />
  );
}

function NoLessons() {
  return <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Šiandien pamokų nėra</p>;
}

function NowLine({ time, left, keepInside }: { time: string; left: number; keepInside?: boolean }) {
  // keepInside (phone): near the strip's ends the "dabar" label shifts so it stays inside the card.
  const shift = keepInside && left < 6 ? "-4px" : keepInside && left > 94 ? "calc(-100% + 6px)" : null;
  return (
    <div
      role="img"
      aria-label={`Dabar ${time}`}
      className="pointer-events-none absolute -top-2 -bottom-2 z-[4] -ml-px w-0.5 rounded-pill bg-foreground"
      style={{ left: `${left}%` }}
    >
      <span
        className={cn(
          "absolute -top-[18px] rounded-pill bg-foreground px-[7px] py-px text-[11px] leading-[15px] font-medium text-background",
          shift ? "left-px" : "left-1/2 -translate-x-1/2"
        )}
        style={shift ? { transform: `translateX(${shift})` } : undefined}
      >
        dabar
      </span>
    </div>
  );
}

function HourLabels({
  labels,
  startHour,
  endHour,
  pct,
  className,
}: {
  labels: number[];
  startHour: number;
  endHour: number;
  pct: (minutes: number) => number;
  className: string;
}) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none relative h-5 text-muted-foreground tabular-nums", className)}>
      {labels.map((h) => (
        <span
          key={h}
          className="absolute"
          style={h === startHour ? { left: 0 } : h === endHour ? { right: 0 } : { left: `${pct(h * 60)}%`, transform: "translateX(-50%)" }}
        >
          {fromMinutes(h * 60).slice(0, 2)}
        </span>
      ))}
    </div>
  );
}
