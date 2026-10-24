import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LessonPage } from "@/components/notes/lesson-page";
import { getLessonPanel } from "@/lib/notes/queries";

export const metadata: Metadata = { title: "Pamoka" };

export default function PamokaPage({ params }: PageProps<"/pamokos/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-[1040px] animate-enter flex-col gap-5">
      <Link href="/" className="mt-4 inline-flex items-center gap-1 self-center rounded-pill text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft aria-hidden="true" className="size-3.5" strokeWidth={2} />
        Šiandien
      </Link>
      <Suspense fallback={<div className="h-[560px] animate-pulse rounded-sheet bg-muted" aria-busy="true" aria-label="Įkeliama" />}>
        <Lesson params={params} />
      </Suspense>
    </div>
  );
}

async function Lesson({ params }: Pick<PageProps<"/pamokos/[id]">, "params">) {
  const { id } = await params;
  const data = await getLessonPanel(id);
  if (!data) notFound();
  return <LessonPage data={data} />;
}
