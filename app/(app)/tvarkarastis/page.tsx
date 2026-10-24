import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { NewLessonButton } from "@/components/lessons/new-lesson";
import { WeekView } from "@/components/lessons/week-view";
import { PageHeader } from "@/components/page-header";
import { listWeekLessons } from "@/lib/lessons/queries";
import { addDays, formatWeekRange, isDate, mondayOf, todayVilnius } from "@/lib/lessons/time";
import { plural } from "@/lib/plural";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tvarkaraštis" };

export default function TvarkarastisPage({ searchParams }: PageProps<"/tvarkarastis">) {
  return (
    <div className="mx-auto w-full max-w-[1040px] animate-enter">
      <Suspense fallback={<WeekSkeleton />}>
        <Week searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Week({ searchParams }: Pick<PageProps<"/tvarkarastis">, "searchParams">) {
  const sp = await searchParams;
  await connection(); // "today" is request-time data (Next 16 cacheComponents)
  const today = todayVilnius();
  // ?savaite=YYYY-MM-DD (any day of the week) – default: this week.
  const monday = mondayOf(isDate(sp.savaite) ? sp.savaite : today);
  const thisWeek = monday === mondayOf(today);
  const lessons = await listWeekLessons(monday);
  const count = lessons.filter((l) => l.status !== "atsaukta").length;
  const weekHref = (m: string) => (m === mondayOf(today) ? "/tvarkarastis" : `/tvarkarastis?savaite=${m}`);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Tvarkaraštis"
        subtitle={`${formatWeekRange(monday)} · ${count ? plural(count, ["pamoka", "pamokos", "pamokų"]) : "pamokų nėra"} · tempk pamoką, kad perkeltum`}
        className="pb-3"
      />

      {/* One row: week navigation left, the black "+ Vienkartinė pamoka" right (phone: a round "+") */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1">
          <Link href={weekHref(addDays(monday, -7))} aria-label="Ankstesnė savaitė" className={btn.icon}>
            <ChevronLeft aria-hidden="true" className="size-[18px]" strokeWidth={2} />
          </Link>
          <Link href={weekHref(mondayOf(today))} aria-current={thisWeek ? "page" : undefined} className={cn(btn.secondary, thisWeek && "pointer-events-none")}>
            Ši savaitė
          </Link>
          <Link href={weekHref(addDays(monday, 7))} aria-label="Kita savaitė" className={btn.icon}>
            <ChevronRight aria-hidden="true" className="size-[18px]" strokeWidth={2} />
          </Link>
        </div>
        <NewLessonButton defaultDate={thisWeek ? today : monday} ariaLabel="Vienkartinė pamoka" className={cn(btn.primary, "ml-auto max-md:size-11 max-md:px-0")}>
          <Plus aria-hidden="true" className="size-4 max-md:size-5" strokeWidth={2} />
          <span className="max-md:hidden">Vienkartinė pamoka</span>
        </NewLessonButton>
      </div>

      <WeekView monday={monday} today={today} lessons={lessons} />
    </div>
  );
}

function WeekSkeleton() {
  return (
    <div className="flex flex-col gap-5 pt-6" aria-busy="true" aria-label="Įkeliama">
      <div className="h-12 w-72 animate-pulse self-center rounded-pill bg-muted" />
      <div className="h-6 w-96 max-w-full animate-pulse self-center rounded-pill bg-muted" />
      <div className="h-11 w-60 animate-pulse rounded-pill bg-muted" />
      <div className="h-[760px] animate-pulse rounded-card bg-muted" />
    </div>
  );
}
