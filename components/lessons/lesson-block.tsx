"use client";

import Link from "next/link";
import { Popover } from "radix-ui";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { initials } from "@/lib/names";
import { LESSON_STATUS } from "@/lib/lessons/constants";
import type { LessonItem } from "@/lib/lessons/queries";
import { formatDayMonth, weekdayOf } from "@/lib/lessons/time";
import { toneBlock, toneDot, weekdayShort } from "@/lib/students/constants";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { BoardLink } from "./board";
import { useLessonPopover } from "./popover-group";

// One lesson block (Tvarkaraštis week view, Šiandien day strip) + its glass popover.
// The block adapts to its width (DESIGN.md §9): name + time → name → initials (CSS in globals.css).
// `square` (the phone day strip): a small square in the student's tone, initials only if they fit,
// with an invisible, larger tap area around it.
// Open / pinned state lives in the shared group controller (popover-group.tsx): one popover at a time.
// The popover shows the display name only (first name, "Ieva K." when shared – lib/names.ts).

const LONG_PRESS = 350; // touch: hold this long, then drag
const TOUCH_SLOP = 10; // px – moving more before that is a scroll, not a drag

export type BlockDrag = {
  onStart: (grabOffset: number) => void;
  onEnd: () => void;
  onTouchMove: (x: number, y: number) => void; // touch drag only (client coordinates)
  onTouchDrop: (x: number, y: number) => void;
};

export type BlockActions = {
  onMove: () => void;
  onCancel: () => void;
  onRestore: () => void;
  onNotes: () => void;
  onBoardMissing: () => void;
};

export function LessonBlock({
  lesson,
  style,
  popoverSide = "bottom",
  highlight = false,
  drag,
  square,
  actions,
  className,
}: {
  lesson: LessonItem;
  style: React.CSSProperties; // position + size, set by the caller
  className?: string; // e.g. week-view's phone layout (globals.css)
  popoverSide?: "top" | "bottom";
  highlight?: boolean; // the lesson happening now: white block with a lifted shadow
  drag?: BlockDrag; // week view only
  square?: { hitArea: React.CSSProperties }; // phone day strip – hitArea positions the tap area around the square
  actions: BlockActions;
}) {
  const popover = useLessonPopover(lesson.id);
  const { open, pinned } = popover;
  const closeAll = popover.close; // stable
  const returnFocus = useRef(false); // closing a pinned popover (Esc, its actions) → focus back to the block
  useEffect(() => {
    if (open) returnFocus.current = pinned;
  }, [open, pinned]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const finePointer = useFinePointer();
  const lastPointer = useRef("");
  const [lifted, setLifted] = useState(false); // touch drag armed: the block "lifts" until drop / cancel

  const cancelled = lesson.status === "atsaukta";
  const canDrag = Boolean(drag) && !cancelled;

  // Touch (iPhone): long-press, then drag – handled here instead of the native HTML5 drag,
  // whose drag image iOS draws as a black square. The week view shows the dashed preview;
  // the block itself lifts (scale + glass shadow) while it is being dragged.
  const dragRef = useRef(drag);
  useEffect(() => {
    dragRef.current = drag;
  });
  useEffect(() => {
    const el = buttonRef.current;
    if (!el || !canDrag) return;
    let press: { x: number; y: number; active: boolean; timer: ReturnType<typeof setTimeout> } | null = null;
    const stop = () => {
      if (press) clearTimeout(press.timer);
      press = null;
      setLifted(false);
    };
    const onStart = (e: TouchEvent) => {
      stop();
      if (e.touches.length !== 1) return;
      const { clientX: x, clientY: y } = e.touches[0];
      const grabOffset = y - el.getBoundingClientRect().top;
      const current = { x, y, active: false, timer: setTimeout(() => {
        current.active = true;
        closeAll();
        setLifted(true);
        navigator.vibrate?.(10); // Android; iOS Safari has no vibrate – harmless
        dragRef.current?.onStart(grabOffset);
        dragRef.current?.onTouchMove(current.x, current.y);
      }, LONG_PRESS) };
      press = current;
    };
    const onMove = (e: TouchEvent) => {
      if (!press) return;
      const { clientX: x, clientY: y } = e.touches[0];
      if (press.active) {
        e.preventDefault(); // no page / week scrolling while dragging
        dragRef.current?.onTouchMove(x, y);
      } else if (Math.hypot(x - press.x, y - press.y) > TOUCH_SLOP) {
        stop();
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (press?.active) {
        e.preventDefault(); // no click → the popover stays closed
        const { clientX: x, clientY: y } = e.changedTouches[0];
        dragRef.current?.onTouchDrop(x, y);
      }
      stop();
    };
    const onCancel = () => {
      if (press?.active) dragRef.current?.onEnd();
      stop();
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onCancel);
    return () => {
      stop();
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [canDrag, closeAll]);
  const past = !lesson.isFuture && !highlight;
  const label = `${lesson.name}, ${lesson.grade}, ${weekdayShort(weekdayOf(lesson.date))} ${lesson.time}–${lesson.endTime}, ${LESSON_STATUS[lesson.status].label}`;

  const hoverIn = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") popover.hoverIn(lesson.id);
  };
  const hoverOut = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") popover.hoverOut();
  };
  // The popover's own actions: focus goes back to the block first, so a dialog the action opens
  // returns focus there when it closes (components/ui/dialog.tsx).
  const close = (then: () => void) => {
    buttonRef.current?.focus({ preventScroll: true });
    popover.close(lesson.id);
    then();
  };

  return (
    <div data-lifted={lifted ? "" : undefined} className={cn("lesson-block absolute", lifted ? "z-[5]" : "z-[1] hover:z-[3]", className)} style={style}>
      <Popover.Root
        open={open}
        onOpenChange={(next) => !next && popover.close(lesson.id)}
      >
        <Popover.Anchor asChild>
          <button
            ref={buttonRef}
            type="button"
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={open}
            draggable={canDrag && finePointer ? true : undefined}
            onPointerEnter={hoverIn}
            onPointerLeave={hoverOut}
            onPointerDown={(e) => (lastPointer.current = e.pointerType)}
            onClick={() => popover.toggle(lesson.id)}
            onDragStart={
              drag &&
              ((e) => {
                // Touch on a device that also has a mouse (iPad + trackpad): the long-press drag handles it.
                if (lastPointer.current === "touch") return e.preventDefault();
                closeAll();
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", lesson.id);
                drag.onStart(e.clientY - e.currentTarget.getBoundingClientRect().top);
              })
            }
            onDragEnd={drag?.onEnd}
            className={cn(
              "block size-full text-left transition-[box-shadow,scale] duration-150 select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground",
              square ? "relative rounded-[5px]" : "overflow-hidden rounded-[10px]",
              cancelled
                ? "border border-dashed border-foreground/25 bg-card text-muted-foreground"
                : highlight
                  ? "bg-card text-foreground shadow-[0_6px_10px_#0000001a,inset_0_0_0_1px_var(--border)]"
                  : cn(toneBlock(lesson.tone), !lifted && "hover:shadow-button", drag && "cursor-grab active:cursor-grabbing"),
              past && !cancelled && "opacity-50",
              // §6 glass hover shadow; a short spring-like ease up to 1.1× (reduced motion: shadow only)
              lifted ? "scale-110 shadow-glass-hover duration-300 ease-[cubic-bezier(.34,1.45,.64,1)] motion-reduce:scale-100" : "ease-standard"
            )}
          >
            {square ? (
              <>
                <span aria-hidden="true" className="absolute" style={square.hitArea} />
                {!cancelled && (
                  <span
                    className={cn(
                      "absolute flex items-center justify-center text-[11px] leading-none font-semibold text-white",
                      highlight ? "inset-[3px] rounded-[3px]" : "inset-0 rounded-[5px]",
                      toneDot(lesson.tone)
                    )}
                  >
                    <span className="hidden @min-[22px]:inline">{initials(lesson.name)}</span>
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="v-full h-full min-w-0 flex-col justify-center gap-px px-2 text-xs leading-[15px]">
                  <span className="flex min-w-0 items-center gap-[5px]">
                    <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-pill", toneDot(lesson.tone))} />
                    <b className={cn("truncate-name font-medium", cancelled && "line-through")}>{lesson.name}</b>
                  </span>
                  <span className="pl-[11px] whitespace-nowrap tabular-nums opacity-85">
                    {lesson.time}–{lesson.endTime}
                  </span>
                </span>
                <span className="v-name h-full min-w-0 items-center gap-[5px] px-2 text-xs">
                  <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-pill", toneDot(lesson.tone))} />
                  <b className={cn("truncate-name font-medium", cancelled && "line-through")}>{lesson.name}</b>
                </span>
                <span className="v-ini h-full items-center justify-center">
                  <span className={cn("ini flex items-center justify-center rounded-pill font-semibold tracking-normal text-white", cancelled ? "bg-muted-foreground/60" : toneDot(lesson.tone))}>
                    {initials(lesson.name)}
                  </span>
                </span>
              </>
            )}
          </button>
        </Popover.Anchor>

        <Popover.Portal>
          <Popover.Content
            side={popoverSide}
            sideOffset={8}
            collisionPadding={16}
            onOpenAutoFocus={(e) => !pinned && e.preventDefault()}
            onCloseAutoFocus={(e) => {
              // Radix would focus a Trigger – this popover has an Anchor, so return focus ourselves,
              // unless focus already went somewhere on purpose (another block, a dialog the action opened).
              e.preventDefault();
              const active = document.activeElement;
              if (returnFocus.current && (!active || active === document.body)) buttonRef.current?.focus();
            }}
            onInteractOutside={(e) => {
              if (buttonRef.current?.contains(e.target as Node)) e.preventDefault(); // its own block toggles on click
              else returnFocus.current = false;
            }}
            onPointerEnter={popover.keep}
            onPointerLeave={hoverOut}
            className="glass glass-border z-50 flex w-[264px] flex-col gap-2.5 rounded-card p-3.5 text-[13px] leading-[18px] shadow-modal outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-pill", toneDot(lesson.tone))} />
              <span className="min-w-0 font-serif text-[19px] leading-[1.2] [overflow-wrap:anywhere]">{lesson.name}</span>
            </span>
            <span className="text-muted-foreground tabular-nums">
              {lesson.grade} · {weekdayShort(weekdayOf(lesson.date))} {formatDayMonth(lesson.date)} · {lesson.time}–{lesson.endTime}
            </span>
            {(lesson.status !== "suplanuota" || lesson.original || lesson.kind === "one_off") && (
              <span className="flex flex-wrap items-center gap-1.5">
                {lesson.status !== "suplanuota" && (
                  <span className={cn("inline-flex h-6 items-center rounded-pill px-2.5 font-medium", LESSON_STATUS[lesson.status].pill)}>
                    {LESSON_STATUS[lesson.status].label}
                  </span>
                )}
                {lesson.kind === "one_off" && <span className="inline-flex h-6 items-center rounded-pill bg-muted px-2.5 font-medium text-muted-foreground">Vienkartinė</span>}
                {lesson.original && (
                  <span className="text-muted-foreground tabular-nums">
                    Perkelta iš {weekdayShort(weekdayOf(lesson.original.date))} {formatDayMonth(lesson.original.date)} {lesson.original.time}
                  </span>
                )}
              </span>
            )}
            {cancelled && lesson.cancelReason && <span className="text-muted-foreground [overflow-wrap:anywhere]">Priežastis: {lesson.cancelReason}</span>}

            {!cancelled && (
              <span className="flex gap-1.5">
                {lesson.meetUrl ? (
                  <a href={lesson.meetUrl} target="_blank" rel="noopener noreferrer" className={cn(popoverButton, "bg-primary text-primary-foreground hover:opacity-90")}>
                    Prisijungti
                  </a>
                ) : (
                  <span aria-disabled="true" title="Meet nuoroda nenurodyta" className={cn(popoverButton, "bg-primary text-primary-foreground opacity-40")}>
                    Prisijungti
                  </span>
                )}
                <BoardLink url={lesson.boardUrl} onMissing={() => close(actions.onBoardMissing)} className={cn(popoverButton, "bg-card text-foreground shadow-[inset_0_0_0_1px_var(--input)]")}>
                  Lenta
                </BoardLink>
                <button type="button" onClick={() => close(actions.onNotes)} className={cn(popoverButton, "bg-card text-foreground shadow-[inset_0_0_0_1px_var(--input)]")}>
                  Užrašai
                </button>
              </span>
            )}
            <span className="-mx-1 flex flex-wrap items-center gap-0.5 border-t pt-2">
              {cancelled ? (
                <PopoverAction onClick={() => close(actions.onRestore)}>Atkurti</PopoverAction>
              ) : (
                <>
                  <PopoverAction onClick={() => close(actions.onMove)}>Perkelti</PopoverAction>
                  <PopoverAction danger onClick={() => close(actions.onCancel)}>
                    Atšaukti
                  </PopoverAction>
                </>
              )}
              <Link href={`/mokiniai/${lesson.studentId}?skirtukas=uzrasai`} className={cn(btn.ghost, "ml-auto h-8 px-2.5 text-[13px] text-muted-foreground")}>
                Profilis
              </Link>
            </span>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

const popoverButton = "inline-flex h-9 items-center rounded-pill px-3 text-[13px] font-medium transition-opacity duration-200";

function PopoverAction({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: string }) {
  return (
    <button type="button" onClick={onClick} className={cn(danger ? btn.danger : btn.ghost, "h-8 px-2.5 text-[13px]")}>
      {children}
    </button>
  );
}

/** Overlapping lessons share the space side by side (lanes), so nothing is hidden. */
export function layoutDay(lessons: LessonItem[]) {
  const sorted = [...lessons].sort((a, b) => a.minutes - b.minutes);
  const result: { lesson: LessonItem; lane: number; lanes: number }[] = [];
  let cluster: { lesson: LessonItem; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const item of cluster) result.push({ ...item, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };

  for (const lesson of sorted) {
    if (lesson.minutes >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= lesson.minutes);
    if (lane === -1) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = lesson.minutes + 60;
    cluster.push({ lesson, lane });
    clusterEnd = Math.max(clusterEnd, lesson.minutes + 60);
  }
  flush();
  return result;
}

/** Mouse / trackpad present → native HTML5 drag; touch-only phones use the long-press drag above. */
function useFinePointer() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(pointer: fine)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(pointer: fine)").matches,
    () => true
  );
}

/**
 * Current time in ms, updated every `everyMs`. Before hydration it returns `serverNow`
 * (or null), so server and client render the same thing.
 */
export function useNow(everyMs = 30_000, serverNow: number | null = null) {
  return useSyncExternalStore(
    (onChange) => {
      const timer = setInterval(onChange, everyMs);
      return () => clearInterval(timer);
    },
    () => Math.floor(Date.now() / everyMs) * everyMs,
    () => serverNow
  );
}
