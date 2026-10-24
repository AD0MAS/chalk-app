import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Journal } from "@/components/finance/journal";
import { PageHeader } from "@/components/page-header";
import { getJournal, journalYears } from "@/lib/finance/queries";
import { todayVilnius } from "@/lib/lessons/time";
import { card } from "@/lib/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mokesčiai" };

export default function MokesciaiPage({ searchParams }: PageProps<"/finansai/mokesciai">) {
  return (
    <div className="mx-auto w-full max-w-[1040px] animate-enter print:max-w-none">
      <Suspense fallback={<Skeleton />}>
        <Taxes searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Taxes({ searchParams }: { searchParams: PageProps<"/finansai/mokesciai">["searchParams"] }) {
  const params = await searchParams;
  await connection(); // "today" is request-time data (Next 16)
  const years = journalYears(todayVilnius());
  const year = years.find((y) => String(y) === params.metai) ?? years[0];
  const data = await getJournal(year);
  return <Journal data={data} years={years} />;
}

function Skeleton() {
  return (
    <>
      <PageHeader title="Mokesčiai" />
      <div className="flex flex-col gap-5" aria-busy="true" aria-label="Įkeliama">
        <div className="mx-auto h-11 w-[200px] animate-pulse rounded-pill bg-muted" />
        <div className={cn(card, "h-[420px] animate-pulse")} />
        <div className={cn(card, "h-[480px] animate-pulse")} />
      </div>
    </>
  );
}
