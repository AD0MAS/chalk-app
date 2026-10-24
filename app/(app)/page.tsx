import { Suspense } from "react";
import { TodayView } from "@/components/today/today-view";
import { getToday } from "@/lib/notes/queries";

export default function SiandienPage() {
  return (
    <div className="mx-auto w-full max-w-[1040px] animate-enter">
      <Suspense fallback={<TodaySkeleton />}>
        <Today />
      </Suspense>
    </div>
  );
}

async function Today() {
  const data = await getToday();
  return <TodayView data={data} />;
}

function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-8 pt-6 max-md:gap-5" aria-busy="true" aria-label="Įkeliama">
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-72 animate-pulse rounded-pill bg-muted" />
        <div className="h-5 w-64 animate-pulse rounded-pill bg-muted" />
      </div>
      <div className="h-[110px] animate-pulse rounded-card bg-muted" />
      <div className="h-[380px] animate-pulse rounded-hero bg-muted" />
      <div className="h-[130px] animate-pulse rounded-card bg-muted" />
      <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[120px] animate-pulse rounded-card bg-muted" />
        ))}
      </div>
    </div>
  );
}
