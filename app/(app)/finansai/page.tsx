import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { FinanceView } from "@/components/finance/finance-view";
import { PageHeader } from "@/components/page-header";
import { getFinance } from "@/lib/finance/queries";
import { readPeriod } from "@/lib/finance/period";
import { todayVilnius } from "@/lib/lessons/time";
import { card } from "@/lib/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Finansai" };

export default function FinansaiPage({ searchParams }: PageProps<"/finansai">) {
  return (
    <div className="mx-auto w-full max-w-[1040px] animate-enter">
      <Suspense fallback={<FinanceSkeleton />}>
        <Finance searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Finance({ searchParams }: { searchParams: PageProps<"/finansai">["searchParams"] }) {
  const params = await searchParams;
  await connection(); // "today" is request-time data (Next 16)
  const period = readPeriod(params, todayVilnius());
  const data = await getFinance(period);
  const sort = typeof params.rikiuoti === "string" ? params.rikiuoti : undefined;
  return <FinanceView period={period} data={data} initialSort={sort} />;
}

function FinanceSkeleton() {
  return (
    <>
      <PageHeader title="Finansai" />
      <div className="flex flex-col gap-5" aria-busy="true" aria-label="Įkeliama">
        <div className="mx-auto h-11 w-[420px] max-w-full animate-pulse rounded-pill bg-muted" />
        <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2 max-md:gap-2.5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[118px] animate-pulse rounded-card bg-muted" />
          ))}
        </div>
        <div className="flex gap-4 max-md:flex-col">
          <div className={cn(card, "h-[360px] flex-[2] animate-pulse")} />
          <div className={cn(card, "h-[360px] flex-1 animate-pulse")} />
        </div>
        <div className={cn(card, "h-[320px] animate-pulse")} />
      </div>
    </>
  );
}
