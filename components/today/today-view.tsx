"use client";

import Link from "next/link";
import { useNow } from "@/components/lessons/lesson-block";
import { useLessonDialogs } from "@/components/lessons/use-lesson-dialogs";
import type { LessonItem } from "@/lib/lessons/queries";
import { capitalize, formatDateLong, formatDayMonth, weekdayOf } from "@/lib/lessons/time";
import type { TodayData } from "@/lib/notes/queries";
import { plural } from "@/lib/plural";
import { formatEur, weekdayLong } from "@/lib/students/constants";
import { card } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { DayStrip, PhoneDayStrip } from "./day-strip";
import { FocusCard, untilText } from "./focus-card";
import { CancelledRow, HeldRow, LessonRow } from "./lesson-rows";

// SPEC §3 screen 1 – Šiandien, top to bottom: greeting + date, day strip, focus card,
// "Toliau šiandien" (one full-width row per lesson), "Jau įvyko", four stat cards – the same on a phone, where
// the day strip is the compact one that fits the width (DESIGN.md §9).
// The clock runs in the browser, so "now", the countdown and the sections stay current without reloading.

const LESSON_MS = 60 * 60_000;

export function TodayView({ data }: { data: TodayData }) {
  const { blockActions, openNotes, askBoard, restore, dialogs } = useLessonDialogs();
  const now = useNow(15_000, data.now) ?? data.now;
  const { today, context } = data;

  const startOf = (l: LessonItem) => Date.parse(l.startsAt);
  const active = data.lessons.filter((l) => l.status !== "atsaukta");
  const cancelled = data.lessons.filter((l) => l.status === "atsaukta");
  const current = active.find((l) => startOf(l) <= now && now < startOf(l) + LESSON_MS) ?? null;
  const upcoming = active.filter((l) => startOf(l) > now);
  const held = active.filter((l) => startOf(l) + LESSON_MS <= now);
  const doneForToday = !current && upcoming.length === 0;
  const nextDayLessons = doneForToday ? (data.nextDay?.lessons ?? []) : [];
  const focus = current ?? upcoming[0] ?? nextDayLessons[0] ?? null;
  const later = upcoming.filter((l) => l !== focus);

  const subtitle = [
    `${weekdayLong(weekdayOf(today))}, ${formatDayMonth(today)}`,
    active.length ? plural(active.length, ["pamoka", "pamokos", "pamokų"]) : "pamokų nėra",
    held.length ? `${held.length} jau įvyko` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-8 max-md:gap-5">
      <header className="flex flex-col items-center gap-2.5 pt-6 text-center max-md:gap-2 max-md:pt-4">
        <h1 className="font-serif text-[44px] leading-[1.05] font-normal tracking-[-0.03em] max-md:text-[32px]">
          Labas, <em>Adomai</em>
        </h1>
        <p className="text-muted-foreground tabular-nums max-md:text-sm">{subtitle}</p>
      </header>

      <DayStrip lessons={data.lessons} now={now} today={today} currentId={current?.id ?? null} actions={blockActions} className="max-md:hidden" />
      <PhoneDayStrip lessons={data.lessons} now={now} today={today} currentId={current?.id ?? null} actions={blockActions} className="md:hidden" />

      {focus ? (
        <FocusCard lesson={focus} ctx={context[focus.id]} now={now} today={today} onNotes={() => openNotes(focus)} onBoardMissing={() => askBoard(focus)} />
      ) : (
        <NoMoreLessons />
      )}

      {later.length > 0 && (
        <section aria-labelledby="later" className="flex flex-col gap-3">
          <h2 id="later" className="mb-1 text-center font-serif text-[28px] leading-[1.1] tracking-[-0.02em] max-md:text-2xl">
            Toliau šiandien
          </h2>
          {later.map((l, i) => (
            <LessonRow key={l.id} lesson={l} ctx={context[l.id]} badge={i === 0 && current ? untilText(startOf(l) - now) : null} onBoardMissing={() => askBoard(l)} />
          ))}
        </section>
      )}

      {doneForToday && nextDayLessons.length > 1 && (
        <section aria-labelledby="next-day" className="flex flex-col gap-3">
          <div className="mb-1 flex flex-col items-center gap-1">
            <h2 id="next-day" className="text-center font-serif text-[28px] leading-[1.1] tracking-[-0.02em] max-md:text-2xl">
              Kitą pamokų dieną
            </h2>
            <span className="text-sm text-muted-foreground">{capitalize(formatDateLong(nextDayLessons[0].date))}</span>
          </div>
          {nextDayLessons.slice(1).map((l) => (
            <LessonRow key={l.id} lesson={l} ctx={context[l.id]} badge={null} onBoardMissing={() => askBoard(l)} />
          ))}
        </section>
      )}

      {(held.length > 0 || cancelled.length > 0) && (
        <section aria-label="Jau įvyko" className="flex flex-col gap-2.5">
          {held.length > 0 && <h3 className="mt-2 text-center text-sm font-medium text-muted-foreground">Jau įvyko</h3>}
          {held.map((l) => (
            <HeldRow key={l.id} lesson={l} ctx={context[l.id]} onNotes={() => openNotes(l)} />
          ))}
          {cancelled.length > 0 && <h3 className="mt-2 text-center text-sm font-medium text-muted-foreground">Atšaukta</h3>}
          {cancelled.map((l) => (
            <CancelledRow key={l.id} lesson={l} onRestore={() => restore(l)} />
          ))}
        </section>
      )}

      <Stats stats={data.stats} />
      {dialogs}
    </div>
  );
}

function NoMoreLessons() {
  return (
    <section className={cn(card, "flex flex-col items-center gap-2 px-6 py-10 text-center")}>
      <h2 className="font-serif text-[26px] leading-[1.15]">Šiandien pamokų daugiau nėra</h2>
      <p className="text-sm text-muted-foreground">Kitų suplanuotų pamokų dar nėra – pridėk per „+ Pamoka“ arba mokinio laikus.</p>
    </section>
  );
}

/* ---------------- stats ---------------- */

function Stats({ stats }: { stats: TodayData["stats"] }) {
  const box = cn(card, "flex min-w-0 flex-col gap-2 p-5 max-md:gap-1.5 max-md:p-4");
  const label = "text-sm text-muted-foreground max-md:text-[13px] truncate-name";
  const value = "font-serif text-4xl leading-none tabular-nums max-md:text-[30px]";
  const meta = "truncate-name text-[13px] text-muted-foreground max-md:text-xs";
  return (
    <section aria-label="Skaičiai" className="grid grid-cols-4 gap-4 max-md:grid-cols-2 max-md:gap-2.5">
      <Link href="/laukia-uzrasu" className={cn(box, "transition-shadow duration-500 ease-soft hover:shadow-glass")}>
        <span className={label}>Laukia užrašų</span>
        <span className={value}>{stats.awaiting}</span>
        <span className={meta} title={stats.awaitingNames.join(", ")}>
          {stats.awaiting ? stats.awaitingNames.join(", ") : "viskas surašyta"}
        </span>
      </Link>
      <Link href="/mokejimai#nepriskirti" className={cn(box, "transition-shadow duration-500 ease-soft hover:shadow-glass")}>
        <span className={label}>Nepriskirti mokėjimai</span>
        <span className={value}>{stats.unassigned}</span>
        <span className={meta}>{stats.unassigned ? `${formatEur(stats.unassignedTotal)} · laukia mokinio` : "viskas priskirta"}</span>
      </Link>
      <Link href="/finansai?rikiuoti=skolos#mokiniai" className={cn(box, "transition-shadow duration-500 ease-soft hover:shadow-glass")}>
        <span className={label}>Skolos</span>
        <span className={cn(value, stats.debtTotal > 0 && "text-coral-ink")}>{formatEur(stats.debtTotal)}</span>
        <span className={meta} title={stats.debtors.join(", ")}>
          {stats.debtors.length ? stats.debtors.join(", ") : "skolų nėra"}
        </span>
      </Link>
      <Link href="/finansai?laikotarpis=savaite" className={cn(box, "transition-shadow duration-500 ease-soft hover:shadow-glass")}>
        <span className={label}>Ši savaitė</span>
        <span className={value}>{formatEur(stats.weekEarned)}</span>
        <span className={meta}>uždirbta · {plural(stats.weekHeld, ["pamoka", "pamokos", "pamokų"])}</span>
      </Link>
    </section>
  );
}
