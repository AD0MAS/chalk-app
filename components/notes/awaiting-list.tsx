"use client";

import { NotebookPen } from "lucide-react";
import { useLessonDialogs } from "@/components/lessons/use-lesson-dialogs";
import { TruncatedText } from "@/components/truncated-text";
import type { LessonItem } from "@/lib/lessons/queries";
import { capitalize, formatDateLong } from "@/lib/lessons/time";
import { toneDot } from "@/lib/students/constants";
import { btn, card } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** Held lessons without notes, newest first; "Rašyti užrašus" opens the Pamoka panel. */
export function AwaitingList({ lessons }: { lessons: LessonItem[] }) {
  const { openNotes, dialogs } = useLessonDialogs();

  if (lessons.length === 0) {
    return (
      <section className={cn(card, "flex flex-col items-center gap-3 px-6 py-12 text-center")}>
        <span className="flex size-14 items-center justify-center rounded-pill border bg-background text-foreground/80">
          <NotebookPen aria-hidden="true" className="size-6" strokeWidth={1.75} />
        </span>
        <h2 className="font-serif text-[22px] leading-[1.15]">
          Viskas <em>surašyta</em>
        </h2>
        <p className="max-w-[420px] text-sm leading-5 text-muted-foreground">Kai pamoka įvyks, o užrašų dar nebus, ji atsiras čia.</p>
      </section>
    );
  }

  return (
    <>
      <ol className="flex flex-col gap-2.5">
        {lessons.map((l) => (
          <li key={l.id} className="flex min-w-0 items-center gap-3 rounded-pill border bg-card py-2.5 pr-2.5 pl-5 shadow-card max-sm:gap-2.5 max-sm:pl-4">
            <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-pill", toneDot(l.tone))} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-center gap-2">
                <TruncatedText className="font-medium">{l.name}</TruncatedText>
                <span className="shrink-0 text-[13px] text-muted-foreground">{l.grade}</span>
              </span>
              <span className="text-[13px] whitespace-nowrap text-muted-foreground tabular-nums">
                {capitalize(formatDateLong(l.date))} · {l.time}
              </span>
            </span>
            <button type="button" onClick={() => openNotes(l)} className={cn(btn.primary, "h-10 px-4 text-sm")}>
              <span className="max-sm:hidden">Rašyti užrašus</span>
              <span className="sm:hidden">Rašyti</span>
            </button>
          </li>
        ))}
      </ol>
      {dialogs}
    </>
  );
}
