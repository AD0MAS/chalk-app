"use client";

import { useEffect, useRef, useState } from "react";
import type { LessonItem } from "@/lib/lessons/queries";
import { addDays, clockChange, formatDayMonth, fromMinutes, vilniusParts, weekdayOf } from "@/lib/lessons/time";
import { weekdayLong, weekdayShort } from "@/lib/students/constants";
import { cn } from "@/lib/utils";
import { layoutDay, LessonBlock, useNow } from "./lesson-block";
import { LessonPopoverGroup } from "./popover-group";
import { useLessonDialogs } from "./use-lesson-dialogs";

// SPEC §3 screen 7 – Tvarkaraštis: one week of Chalk lessons only (never Google events),
// blocks in the student's tone that adapt to their width (DESIGN.md §9), a glass popover
// on hover/click, drag & drop to reschedule (opens the Perkelti dialog).
// Phone (< 768px): all 7 days fit the card – narrow columns, initials circles, tap → popover,
// long-press → drag (Phase 5 T6a). The desktop layout is unchanged.
// Sizes live in CSS (globals.css .week-grid): --h = px per hour (desktop 56px, phone = the
// day column's width, so a 60-min block is a square), --start / --end = visible hours.

const SNAP = 15; // minutes
const DAY_LETTERS = ["Pr", "An", "Tr", "Kt", "Pn", "Št", "Sk"]; // phone day headers
const EDGE = { top: 84, bottom: 40 }; // px – a touch drag this close to the viewport edge scrolls the page (navbar on top)
const PHONE = "(max-width: 767.98px)";

/** CSS length `hours` hours below the grid's first visible hour (+ an offset). */
const y = (hours: number, plus = "0px") => `calc((${hours} - var(--start)) * var(--h) + ${plus})`;
const gridHeight = "calc((var(--end) - var(--start)) * var(--h))";
// A block / drop preview inside its hour row: --inset above and below (as on the sides)
const blockTop = (minutes: number) => y(minutes / 60, "var(--inset)");
const blockHeight = "calc(var(--h) - 2 * var(--inset))";

export function WeekView({ monday, today, lessons }: { monday: string; today: string; lessons: LessonItem[] }) {
  const { openMove, blockActions, dialogs } = useLessonDialogs();
  const nowMs = useNow();
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  // Visible hours: desktop 09–21, phone 08–24, widened if a lesson falls outside. Both are
  // rendered; CSS picks one (phone ⊇ desktop, so hours outside the desktop range are md:hidden).
  const first = Math.min(...lessons.map((l) => Math.floor(l.minutes / 60)));
  const last = Math.max(...lessons.map((l) => Math.ceil((l.minutes + 60) / 60)));
  const desktop = { start: Math.max(0, Math.min(9, first)), end: Math.min(24, Math.max(21, last)) };
  const phone = { start: Math.max(0, Math.min(8, first)), end: 24 };
  const onDesktop = (minutes: number) => minutes >= desktop.start * 60 && minutes <= desktop.end * 60;

  // Drag & drop (mouse: HTML5 drag, touch: long-press – lesson-block.tsx): where the dragged
  // block would land, snapped to 15 minutes.
  const dragging = useRef<{ lesson: LessonItem; grabOffset: number } | null>(null);
  const [dropAt, setDropAt] = useState<{ date: string; minutes: number } | null>(null);

  function dropMinutes(clientY: number, column: HTMLElement) {
    const { start, end } = window.matchMedia(PHONE).matches ? phone : desktop;
    const rect = column.getBoundingClientRect();
    const hourPx = rect.height / (end - start);
    const offset = clientY - rect.top - (dragging.current?.grabOffset ?? 0);
    const raw = start * 60 + (offset / hourPx) * 60;
    const snapped = Math.round(raw / SNAP) * SNAP;
    return Math.min(Math.max(snapped, start * 60), end * 60 - 60);
  }

  function showDropAt(date: string, minutes: number) {
    setDropAt((prev) => (prev?.date === date && prev.minutes === minutes ? prev : { date, minutes }));
  }

  function drop(date: string, minutes: number) {
    const drag = dragging.current;
    dragging.current = null;
    setDropAt(null);
    if (!drag) return;
    const time = fromMinutes(minutes);
    if (date === drag.lesson.date && time === drag.lesson.time) return;
    openMove(drag.lesson, { date, time });
  }

  function onDragOver(e: React.DragEvent<HTMLElement>, date: string) {
    if (!dragging.current || date < today) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    showDropAt(date, dropMinutes(e.clientY, e.currentTarget));
  }

  function onDrop(e: React.DragEvent<HTMLElement>, date: string) {
    if (!dragging.current || date < today) return;
    e.preventDefault();
    drop(date, dropMinutes(e.clientY, e.currentTarget));
  }

  // Touch: the day column under the finger, by x only – also above / below the grid and in the
  // thin gaps between columns (the nearest column wins); only today or later.
  const grid = useRef<HTMLDivElement>(null);
  function columnAt(x: number) {
    let best: { column: HTMLElement; distance: number } | null = null;
    for (const column of grid.current?.querySelectorAll<HTMLElement>("[data-day]") ?? []) {
      const r = column.getBoundingClientRect();
      const distance = Math.max(r.left - x, x - r.right, 0);
      if (!best || distance < best.distance) best = { column, distance };
    }
    const date = best?.column.dataset.day;
    return best && best.distance <= 8 && date && date >= today ? { column: best.column, date } : null;
  }

  function showTouchDrop(x: number, y: number) {
    const target = columnAt(x);
    if (!dragging.current || !target) return setDropAt(null);
    showDropAt(target.date, dropMinutes(y, target.column));
  }

  // Touch scrolling is blocked during a drag, so near the top / bottom edge the page scrolls
  // by itself – every hour can be reached.
  const finger = useRef<{ x: number; y: number } | null>(null);
  const scrollFrame = useRef(0);
  function edgeScroll() {
    scrollFrame.current = 0;
    const p = finger.current;
    if (!p || !dragging.current) return;
    const over = p.y < EDGE.top ? p.y - EDGE.top : Math.max(0, p.y - (window.innerHeight - EDGE.bottom));
    if (!over) return;
    window.scrollBy(0, Math.sign(over) * Math.min(14, 2 + Math.abs(over) / 4));
    showTouchDrop(p.x, p.y);
    scrollFrame.current = requestAnimationFrame(edgeScroll);
  }
  function stopTouch() {
    finger.current = null;
    cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = 0;
  }
  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);

  function onTouchMove(x: number, y: number) {
    finger.current = { x, y };
    showTouchDrop(x, y);
    if (!scrollFrame.current) scrollFrame.current = requestAnimationFrame(edgeScroll);
  }

  function onTouchDrop(x: number, y: number) {
    stopTouch();
    const target = columnAt(x);
    if (!target) {
      dragging.current = null;
      setDropAt(null);
      return;
    }
    drop(target.date, dropMinutes(y, target.column));
  }

  const now = nowMs === null ? null : vilniusParts(new Date(nowMs));

  // Narrow desktop windows (768–~880px) still scroll the week sideways – start at today.
  // On phones the whole week fits, so this does nothing.
  const scroller = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = scroller.current;
    const column = el?.querySelector<HTMLElement>("[data-today]");
    if (!el || !column || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft += column.getBoundingClientRect().left - el.getBoundingClientRect().left - 64; // keep the hour labels' width
  }, [monday]);

  // One popover group for the whole week: only one lesson popover open at a time.
  return (
    <LessonPopoverGroup>
      <section ref={scroller} aria-label="Savaitės tvarkaraštis" className="overflow-x-auto rounded-card border bg-card px-3 pt-3 pb-4 shadow-card max-md:px-1.5 max-md:pt-2">
        <div className="md:min-w-[820px]">
          {/* Day headers */}
          <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] gap-1.5 pb-2.5 max-md:grid-cols-[20px_repeat(7,minmax(0,1fr))] max-md:gap-0.5 max-md:pb-2">
            <span />
            {days.map((d) => (
              <div
                key={d}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-tile py-1.5 max-md:rounded-[12px]",
                  d === today ? "bg-primary text-primary-foreground" : "text-foreground"
                )}
              >
                <span className="text-xs font-medium opacity-80 max-md:hidden">{weekdayShort(weekdayOf(d))}</span>
                <span className="text-[11px] leading-[14px] font-medium opacity-80 md:hidden">{DAY_LETTERS[weekdayOf(d) - 1]}</span>
                <span className="font-serif text-[22px] leading-none tabular-nums max-md:text-[19px]">{Number(d.slice(8, 10))}</span>
              </div>
            ))}
          </div>

          <div
            ref={grid}
            className="week-grid grid grid-cols-[52px_repeat(7,minmax(0,1fr))] gap-1.5 max-md:grid-cols-[20px_repeat(7,minmax(0,1fr))] max-md:gap-0.5"
            style={
              {
                "--start-d": desktop.start,
                "--end-d": desktop.end,
                "--start-p": phone.start,
                "--end-p": phone.end,
              } as React.CSSProperties
            }
          >
            {/* Hour labels ("09:00", phone "09") */}
            <div aria-hidden="true" className="relative" style={{ height: gridHeight }}>
              {Array.from({ length: phone.end - phone.start - 1 }, (_, i) => phone.start + i + 1).map((h) => (
                <span
                  key={h}
                  className={cn(
                    "absolute right-2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums max-md:right-0.5 max-md:text-[11px]",
                    (h <= desktop.start || h >= desktop.end) && "md:hidden"
                  )}
                  style={{ top: y(h) }}
                >
                  <span className="max-md:hidden">{fromMinutes(h * 60)}</span>
                  <span className="md:hidden">{fromMinutes(h * 60).slice(0, 2)}</span>
                </span>
              ))}
            </div>

            {days.map((d) => {
              const dayLessons = layoutDay(lessons.filter((l) => l.date === d));
              const change = clockChange(d);
              return (
                <div
                  key={d}
                  role="group"
                  data-today={d === today ? "" : undefined}
                  data-day={d}
                  aria-label={`${weekdayLong(weekdayOf(d))}, ${formatDayMonth(d)} – ${dayLessons.length ? `${dayLessons.length} pam.` : "pamokų nėra"}`}
                  onDragOver={(e) => onDragOver(e, d)}
                  onDrop={(e) => onDrop(e, d)}
                  className={cn("relative rounded-tile", d === today && "bg-foreground/[.02]")}
                  style={{
                    height: gridHeight,
                    backgroundImage: "repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px var(--h))",
                  }}
                >
                  {dayLessons.map(({ lesson, lane, lanes }) => (
                    <LessonBlock
                      key={lesson.id}
                      lesson={lesson}
                      // left / width come from the lanes (globals.css .week-block – side by side on desktop)
                      className={cn("week-block", lanes > 1 && "week-overlap")}
                      style={
                        {
                          top: blockTop(lesson.minutes),
                          height: blockHeight,
                          "--lane": lane,
                          "--lanes": lanes,
                          "--f": lanes > 1 ? lane / (lanes - 1) : 0,
                        } as React.CSSProperties
                      }
                      popoverSide={lesson.minutes >= 16 * 60 ? "top" : "bottom"}
                      drag={{
                        onStart: (grabOffset) => (dragging.current = { lesson, grabOffset }),
                        onEnd: () => {
                          dragging.current = null;
                          setDropAt(null);
                          stopTouch();
                        },
                        onTouchMove,
                        onTouchDrop,
                      }}
                      actions={blockActions(lesson)}
                    />
                  ))}

                  {dropAt?.date === d && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute right-[3px] left-[3px] flex items-start rounded-[10px] border border-dashed border-foreground/40 bg-card/70 px-2 py-1 text-xs font-medium tabular-nums max-md:right-0.5 max-md:left-0.5 max-md:z-[2] max-md:justify-center max-md:px-0 max-md:text-[10px]"
                      style={{ top: blockTop(dropAt.minutes), height: blockHeight }}
                    >
                      {fromMinutes(dropAt.minutes)}
                    </div>
                  )}

                  {now && now.date === d && now.minutes >= phone.start * 60 && (
                    <div
                      role="img"
                      aria-label={`Dabar ${now.time}`}
                      className={cn("pointer-events-none absolute -right-[3px] -left-[3px] z-[4] h-0.5 rounded-pill bg-foreground", !onDesktop(now.minutes) && "md:hidden")}
                      style={{ top: y(now.minutes / 60) }}
                    >
                      <span className="absolute -top-[3px] -left-1 size-2 rounded-pill bg-foreground" />
                    </div>
                  )}

                  {change && (
                    <div className="absolute right-1 bottom-1.5 left-1 z-0 rounded-[10px] bg-sand-tint px-2 py-1.5 text-[11px] leading-[14px] text-sand-ink max-md:right-0.5 max-md:bottom-1 max-md:left-0.5 max-md:px-0.5 max-md:text-center max-md:text-[10px] max-md:leading-[12px]">
                      <span className="max-md:sr-only">
                        {change.to < change.from ? "Laikrodžiai atsukami 1 val. atgal" : "Laikrodžiai pasukami 1 val. pirmyn"} ({change.from} → {change.to})
                      </span>
                      {/* Phone: the column is ~40px wide – just the shift ("−1 val.", two lines) */}
                      <span aria-hidden="true" className="md:hidden">
                        {change.to < change.from ? "−1" : "+1"} val.
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {dialogs}
    </LessonPopoverGroup>
  );
}
