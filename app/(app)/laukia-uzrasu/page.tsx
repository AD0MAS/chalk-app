import type { Metadata } from "next";
import { Suspense } from "react";
import { AwaitingList } from "@/components/notes/awaiting-list";
import { PageHeader } from "@/components/page-header";
import { formatDayMonth } from "@/lib/lessons/time";
import { NOTES_START } from "@/lib/notes/constants";
import { listAwaitingNotes } from "@/lib/notes/queries";

export const metadata: Metadata = { title: "Laukia užrašų" };

// SPEC §1 Lesson notes – past held lessons without notes (from NOTES_START on).
export default function LaukiaUzrasuPage() {
  return (
    <div className="mx-auto w-full max-w-[720px] animate-enter">
      <PageHeader title="Laukia užrašų" subtitle={`Įvykusios pamokos be užrašų · nuo ${formatDayMonth(NOTES_START)}`} />
      <Suspense
        fallback={
          <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Įkeliama">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-[62px] animate-pulse rounded-pill bg-muted" />
            ))}
          </div>
        }
      >
        <Awaiting />
      </Suspense>
    </div>
  );
}

async function Awaiting() {
  const lessons = await listAwaitingNotes();
  return <AwaitingList lessons={lessons} />;
}
