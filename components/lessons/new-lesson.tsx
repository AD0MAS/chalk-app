"use client";

import { useEffect, useState, useTransition } from "react";
import { Notice } from "@/components/notice";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LESSONS_START } from "@/lib/lessons/constants";
import { createOneOffLesson, getDayLessons, getLessonStudents } from "@/lib/lessons/actions";
import type { LessonItem, LessonStudent } from "@/lib/lessons/queries";
import { capitalize, formatDateLong, todayVilnius, vilniusParts, weekdayAbbr, weekdayGenitive } from "@/lib/lessons/time";
import { STATUSES, formatEur, toneDot } from "@/lib/students/constants";
import { btn, field, label } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { CalendarNote, ConflictWarning, DayPreview, overlapping } from "./day-preview";

// "+ Pamoka" – a one-off lesson for any student (SPEC §1). Used by the navbar, Tvarkaraštis and /pamokos/nauja.

/** Trigger + dialog. Students are loaded when the dialog opens. */
export function NewLessonButton({
  className,
  children,
  defaultDate,
  ariaLabel,
}: {
  className: string;
  children: React.ReactNode;
  defaultDate?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <>
      <button type="button" aria-label={ariaLabel} onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader className="pr-12">
            <DialogTitle>
              Nauja <em>pamoka</em>
            </DialogTitle>
            <DialogDescription>Vienkartinė pamoka – savaitinius laikus keisk mokinio formoje.</DialogDescription>
          </DialogHeader>
          {open && (
            <StudentsLoader>
              {(students) => (
                <NewLessonForm
                  students={students}
                  defaultDate={defaultDate}
                  onDone={(message) => {
                    setOpen(false);
                    setNotice(message);
                  }}
                  cancel={
                    <DialogClose asChild>
                      <button type="button" className={btn.ghost}>
                        Atšaukti
                      </button>
                    </DialogClose>
                  }
                />
              )}
            </StudentsLoader>
          )}
        </DialogContent>
      </Dialog>
      <Notice message={notice} onClear={() => setNotice(null)} />
    </>
  );
}

function StudentsLoader({ children }: { children: (students: LessonStudent[]) => React.ReactNode }) {
  const [students, setStudents] = useState<LessonStudent[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    getLessonStudents()
      .then(setStudents)
      .catch(() => setFailed(true));
  }, []);
  if (failed) return <p className="text-sm text-coral-ink">Nepavyko įkelti mokinių. Pabandyk dar kartą.</p>;
  if (!students) return <div aria-busy="true" aria-label="Įkeliama" className="h-[420px] animate-pulse rounded-card bg-muted" />;
  return children(students);
}

// Order in the student picker: ad-hoc students first – they are the usual reason for a one-off lesson.
const GROUP_ORDER = ["nepastovus", "derinama", "pastovus", "pauze"] as const;

export function NewLessonForm({
  students,
  defaultDate,
  onDone,
  cancel,
}: {
  students: LessonStudent[];
  defaultDate?: string;
  onDone: (message: string) => void;
  cancel: React.ReactNode;
}) {
  const today = todayVilnius();
  const [studentId, setStudentId] = useState("");
  const [date, setDate] = useState(defaultDate && defaultDate >= LESSONS_START ? defaultDate : today);
  const [time, setTime] = useState("18:00");
  const [day, setDay] = useState<{ date: string; lessons: LessonItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const student = students.find((s) => s.id === studentId);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= LESSONS_START;

  useEffect(() => {
    if (!validDate) return;
    let current = true;
    getDayLessons(date)
      .then((lessons) => current && setDay({ date, lessons }))
      .catch(() => current && setDay({ date, lessons: [] }));
    return () => {
      current = false;
    };
  }, [date, validDate]);

  const dayLessons = day?.date === date ? day.lessons : [];
  const conflicts = time ? overlapping(dayLessons, time) : [];
  const now = vilniusParts(new Date());
  const inPast = validDate && (date < now.date || (date === now.date && time < now.time));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!student) return setError("Pasirink mokinį.");
    setError(null);
    startTransition(async () => {
      const result = await createOneOffLesson(student.id, date, time);
      if (result.ok) onDone(`Pamoka pridėta: ${student.name}, ${weekdayAbbr(date)} ${time}`);
      else setError(result.message);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-student" className={label}>
          Mokinys
        </label>
        <div className="flex items-center gap-2.5">
          <select id="new-student" value={studentId} onChange={(e) => setStudentId(e.target.value)} className={cn(field, "px-3")}>
            <option value="" disabled>
              Pasirink mokinį…
            </option>
            {GROUP_ORDER.map((status) => {
              const group = students.filter((s) => s.status === status);
              if (!group.length) return null;
              return (
                <optgroup key={status} label={STATUSES.find((s) => s.value === status)?.tab}>
                  {group.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.grade}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          {student && (
            <span className="flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground tabular-nums">
              <span aria-hidden="true" className={cn("size-2 rounded-pill", toneDot(student.tone))} />
              {formatEur(student.price)}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-date" className={label}>
            Data
          </label>
          <input id="new-date" type="date" min={LESSONS_START} required value={date} onChange={(e) => setDate(e.target.value)} className={cn(field, "tabular-nums")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-time" className={label}>
            Laikas
          </label>
          <div
            className={cn(
              field,
              "flex items-center gap-2.5 focus-within:shadow-[inset_0_0_0_1px_rgba(3,3,2,.3),0_0_0_3px_rgba(3,3,2,.08)]",
              conflicts.length > 0 && "shadow-[inset_0_0_0_2px_var(--sand)]"
            )}
          >
              <input
              id="new-time"
              type="time"
              step={300}
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-medium tabular-nums outline-none"
            />
            <span className="shrink-0 text-[13px] text-muted-foreground">60 min</span>
          </div>
        </div>
      </div>

      {validDate ? (
        <DayPreview
          lessons={dayLessons}
          time={time || "18:00"}
          candidate={{ name: student?.name ?? "Nauja pamoka", tone: student?.tone ?? "slate" }}
          label={`${capitalize(weekdayGenitive(date))} pamokos`}
          onPickTime={setTime}
          loading={day?.date !== date}
          minTime={date === now.date ? now.time : undefined}
        />
      ) : (
        <p className="text-sm text-coral-ink">Pamokos skaičiuojamos nuo {LESSONS_START}.</p>
      )}

      <ConflictWarning conflicts={conflicts} />
      {inPast && (
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          {capitalize(formatDateLong(date))} {time} jau praėjo – pamoka bus skaičiuojama kaip įvykusi.
        </p>
      )}
      <CalendarNote />
      {error && (
        <p role="alert" className="text-sm text-coral-ink">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {cancel}
        <button type="submit" disabled={pending || !validDate || !time} className={btn.primary}>
          {pending ? "Pridedama…" : "Pridėti pamoką"}
        </button>
      </div>
    </form>
  );
}
