import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { StudentsBrowser, type StudentRow, type Tab } from "@/components/students/students-browser";
import { displayNames } from "@/lib/names";
import { plural } from "@/lib/plural";
import { STATUSES, formatEur, formatGrade, formatSchedule, isSlotActive, todayInVilnius } from "@/lib/students/constants";
import { countStudentsByStatus, listStudents } from "@/lib/students/queries";
import { getBalances } from "@/lib/payments/queries";
import { card } from "@/lib/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mokiniai" };

export default function MokiniaiPage({ searchParams }: PageProps<"/mokiniai">) {
  return (
    <div className="mx-auto w-full max-w-[1040px] animate-enter">
      <Suspense fallback={<ListSkeleton />}>
        <StudentsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function StudentsSection({ searchParams }: { searchParams: PageProps<"/mokiniai">["searchParams"] }) {
  const params = await searchParams;
  const statusParam = typeof params.statusas === "string" ? params.statusas : undefined;
  const tab: Tab = STATUSES.some((s) => s.value === statusParam) ? (statusParam as Tab) : "visi";

  const [students, counts, balances] = await Promise.all([listStudents(), countStudentsByStatus(), getBalances()]);
  const today = todayInVilnius();
  const names = displayNames(students.map((s) => ({ id: s.id, firstName: s.first_name, lastName: s.last_name })));

  const weeklyLessons = students
    .filter((s) => s.status !== "archyvuotas")
    .reduce((sum, s) => sum + s.schedule_slots.filter((slot) => isSlotActive(slot, today)).length, 0);

  const rows: StudentRow[] = students.map((s) => {
    const current = s.schedule_slots.filter((slot) => isSlotActive(slot, today));
    const upcoming = s.schedule_slots.filter((slot) => slot.valid_from > today && slot.valid_to === null);
    const schedule = current.length
      ? formatSchedule(current)
      : upcoming.length
        ? `${formatSchedule(upcoming)} (nuo ${upcoming[0].valid_from.slice(5)})`
        : "Laikas nesutartas";
    return {
      id: s.id,
      name: names.get(s.id) ?? s.first_name,
      fullName: [s.first_name, s.last_name].filter(Boolean).join(" "),
      grade: formatGrade(s.grade, s.math_level),
      status: s.status,
      tone: s.tone,
      schedule,
      hasSchedule: current.length > 0,
      price: formatEur(Number(s.price)),
      balance: balances.get(s.id)?.balance ?? 0,
      unitPrice: Number(s.price),
    };
  });

  return (
    <>
      <PageHeader
        title="Mokiniai"
        subtitle={
          counts.visi > 0
            ? `${plural(counts.visi, ["mokinys", "mokiniai", "mokinių"])} · ${plural(weeklyLessons, ["pamoka", "pamokos", "pamokų"])} per savaitę`
            : undefined
        }
      />
      <StudentsBrowser rows={rows} counts={counts} tab={tab} />
    </>
  );
}

function ListSkeleton() {
  return (
    <>
      <PageHeader title="Mokiniai" />
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Įkeliama">
        <div className="h-11 w-full animate-pulse rounded-pill bg-muted" />
        <div className={cn(card, "flex flex-col gap-3 p-4")}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-tile bg-muted" />
          ))}
        </div>
      </div>
    </>
  );
}
