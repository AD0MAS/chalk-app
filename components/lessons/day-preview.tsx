"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { TruncatedText } from "@/components/truncated-text";
import type { LessonItem } from "@/lib/lessons/queries";
import { fromMinutes, toMinutes } from "@/lib/lessons/time";
import { toneBlock, toneDot, type StudentTone } from "@/lib/students/constants";
import { cn } from "@/lib/utils";

// Shared by the Perkelti and + Pamoka dialogs: that day's other lessons, the new one,
// overlap warning (lessons only – never Google events) and free full hours.

const HOUR = 32; // px per hour in the mini timeline
const WINDOW = 8; // hours shown

/** Lessons on that day that overlap [time, time + 60 min). Cancelled ones don't count. */
export function overlapping(lessons: LessonItem[], time: string) {
  const start = toMinutes(time);
  return lessons.filter((l) => l.status !== "atsaukta" && l.minutes < start + 60 && start < l.minutes + 60);
}

export function DayPreview({
  lessons,
  time,
  candidate,
  label,
  onPickTime,
  minTime,
  loading = false,
}: {
  lessons: LessonItem[]; // that day, without the lesson being moved
  time: string;
  candidate: { name: string; tone: StudentTone };
  label: string; // "Šeštadienio pamokos"
  onPickTime: (time: string) => void;
  minTime?: string; // today: no free-time chips before now
  loading?: boolean; // that day's lessons are still being fetched
}) {
  const visible = lessons.filter((l) => l.status !== "atsaukta");
  const startHour = Math.min(Math.max(Math.floor(toMinutes(time) / 60) - 3, 7), 23 - WINDOW);
  const top = (minutes: number) => ((minutes - startHour * 60) / 60) * HOUR;
  const inWindow = (minutes: number) => minutes + 60 > startHour * 60 && minutes < (startHour + WINDOW) * 60;

  const free: string[] = [];
  for (let h = startHour; h < startHour + WINDOW; h++) {
    const t = fromMinutes(h * 60);
    if (minTime && t < minTime) continue;
    if (overlapping(visible, t).length === 0 && t !== time) free.push(t);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] text-muted-foreground">
          {loading ? "Įkeliamos tos dienos pamokos…" : free.length ? "Laisvi laikai" : "Šiame lange laisvų valandų nėra"}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {!loading && free.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onPickTime(t)}
              className="inline-flex h-9 items-center rounded-pill bg-card px-3.5 text-sm font-medium tabular-nums shadow-[inset_0_0_0_1px_var(--input)] transition-colors duration-150 hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div
        role="group"
        aria-label={label}
        aria-busy={loading}
        className={cn("relative overflow-hidden rounded-tile border bg-card transition-opacity duration-150", loading && "opacity-50")}
        style={{ height: WINDOW * HOUR }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR - 1}px, var(--border) ${HOUR - 1}px ${HOUR}px)` }}
        />
        <div aria-hidden="true" className="absolute top-0 left-2.5 flex flex-col text-[11px] text-muted-foreground tabular-nums" style={{ lineHeight: `${HOUR}px` }}>
          {Array.from({ length: WINDOW }, (_, i) => (
            <span key={i}>{fromMinutes((startHour + i) * 60)}</span>
          ))}
        </div>
        {visible.filter((l) => inWindow(l.minutes)).map((l) => (
          <div
            key={l.id}
            className={cn("absolute right-2 left-[52px] flex h-7 min-w-0 items-center gap-1.5 rounded-[8px] px-2 text-xs font-medium", toneBlock(l.tone))}
            style={{ top: top(l.minutes) + 2 }}
          >
            <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-pill", toneDot(l.tone))} />
            <TruncatedText>{l.name}</TruncatedText>
            <span className="ml-auto shrink-0 tabular-nums">{l.time}</span>
          </div>
        ))}
        {inWindow(toMinutes(time)) && (
          <div
            className="absolute right-3.5 left-[76px] flex h-7 min-w-0 items-center gap-1.5 rounded-[8px] bg-card px-2 text-xs font-medium shadow-[0_6px_12px_#0000001a,inset_0_0_0_1px_rgba(3,3,2,.2)]"
            style={{ top: top(toMinutes(time)) + 8 }}
          >
            <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-pill", toneDot(candidate.tone))} />
            <TruncatedText>{candidate.name}</TruncatedText>
            <span className="ml-auto shrink-0 tabular-nums">{time} · nauja</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** The one soft tint on the dialog (DESIGN.md §0.3): overlap warning. Moving is still allowed. */
export function ConflictWarning({ conflicts }: { conflicts: LessonItem[] }) {
  if (conflicts.length === 0) return null;
  return (
    <div role="alert" className="flex gap-2.5 rounded-tile bg-sand-tint px-3.5 py-3 text-sm leading-[19px] text-sand-ink">
      <AlertTriangle aria-hidden="true" className="mt-px size-[18px] shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 [overflow-wrap:anywhere]">
        <b className="font-medium">Kertasi su {conflicts.length > 1 ? "pamokomis" : "pamoka"}:</b>{" "}
        {conflicts.map((c) => `${c.name} (${c.grade}, ${c.time}–${c.endTime})`).join(", ")}. Galima vis tiek arba rinktis laisvą laiką.
      </span>
    </div>
  );
}

/** Google Calendar is Phase 2 – say honestly what happens now. */
export function CalendarNote() {
  return (
    <p className="flex items-center gap-2 text-[13px] leading-[18px] text-muted-foreground">
      <RefreshCw aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
      Google Calendar dar neprijungtas – prijungus pakeitimai atsiras ir kalendoriuje „Pamokos“.
    </p>
  );
}
