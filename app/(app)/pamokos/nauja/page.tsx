import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { listLessonStudents } from "@/lib/lessons/queries";
import { card } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { NewLessonPageForm } from "./new-lesson-page-form";

export const metadata: Metadata = { title: "Nauja pamoka" };

// Usually "+ Pamoka" opens a dialog; this page is the same form for a direct link.
export default function NaujaPamokaPage() {
  return (
    <div className="mx-auto w-full max-w-[720px] animate-enter">
      <PageHeader
        title={
          <>
            Nauja <em>pamoka</em>
          </>
        }
        subtitle="Vienkartinė pamoka – savaitinius laikus keisk mokinio formoje."
      />
      <section className={cn(card, "p-6 max-sm:p-5")}>
        <Suspense fallback={<div aria-busy="true" aria-label="Įkeliama" className="h-[420px] animate-pulse rounded-card bg-muted" />}>
          <Form />
        </Suspense>
      </section>
    </div>
  );
}

async function Form() {
  const students = await listLessonStudents();
  return <NewLessonPageForm students={students} />;
}
