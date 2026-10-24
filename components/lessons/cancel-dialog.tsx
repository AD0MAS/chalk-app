"use client";

import { CalendarClock } from "lucide-react";
import { useState, useTransition } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cancelLesson } from "@/lib/lessons/actions";
import type { LessonItem } from "@/lib/lessons/queries";
import { formatDateLong } from "@/lib/lessons/time";
import { toneDot } from "@/lib/students/constants";
import { btn, field } from "@/lib/ui";
import { cn } from "@/lib/utils";

// SPEC §1 Cancel: first suggest rescheduling; a cancelled lesson is never charged.

export function CancelDialog({
  lesson,
  onOpenChange,
  onMoveInstead,
  onSaved,
}: {
  lesson: LessonItem | null; // null = closed
  onOpenChange: (open: boolean) => void;
  onMoveInstead: (lesson: LessonItem) => void;
  onSaved?: (message: string) => void;
}) {
  return (
    <Dialog open={lesson !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {lesson && (
          <CancelForm
            key={lesson.id}
            lesson={lesson}
            onDone={() => {
              onOpenChange(false);
              onSaved?.("Pamoka atšaukta – į balansą neskaičiuojama");
            }}
            onMoveInstead={onMoveInstead}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CancelForm({ lesson, onDone, onMoveInstead }: { lesson: LessonItem; onDone: () => void; onMoveInstead: (lesson: LessonItem) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await cancelLesson(lesson.id, reason);
      if (result.ok) onDone();
      else setError(result.message);
    });
  }

  return (
    <>
      <DialogHeader className="pr-12">
        <DialogTitle>Atšaukti pamoką?</DialogTitle>
        <DialogDescription className="flex min-w-0 items-center gap-1.5 text-sm">
          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-pill", toneDot(lesson.tone))} />
          <span className="truncate-name">{lesson.name}</span>
          <span className="shrink-0 whitespace-nowrap">
            · {lesson.grade} · {formatDateLong(lesson.date)} {lesson.time}
          </span>
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3 rounded-tile border bg-card p-4">
        <div className="flex gap-3">
          <CalendarClock aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">Gal geriau perkelti?</span>
            <span className="text-sm leading-5 text-muted-foreground">Perkelta pamoka lieka sąraše ir bus apmokėta kaip įprasta.</span>
          </div>
        </div>
        <button type="button" onClick={() => onMoveInstead(lesson)} className={cn(btn.small, "self-start")}>
          Perkelti vietoj to
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cancel-reason" className="text-sm font-medium">
          Priežastis <span className="font-normal text-muted-foreground">· neprivaloma</span>
        </label>
        <input
          id="cancel-reason"
          maxLength={200}
          autoComplete="off"
          placeholder="pvz. sirgo"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={field}
        />
        <span className="text-[13px] text-muted-foreground">Atšaukta pamoka niekada neskaičiuojama į balansą. Ją galima atkurti.</span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-coral-ink">
          {error}
        </p>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <button type="button" className={btn.ghost}>
            Palikti
          </button>
        </DialogClose>
        <button type="button" disabled={pending} onClick={submit} className={btn.dangerSolid}>
          {pending ? "Atšaukiama…" : "Atšaukti pamoką"}
        </button>
      </DialogFooter>
    </>
  );
}
