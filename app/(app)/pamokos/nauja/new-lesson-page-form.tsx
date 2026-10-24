"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { NewLessonForm } from "@/components/lessons/new-lesson";
import type { LessonStudent } from "@/lib/lessons/queries";
import { btn } from "@/lib/ui";

export function NewLessonPageForm({ students }: { students: LessonStudent[] }) {
  const router = useRouter();
  return (
    <NewLessonForm
      students={students}
      onDone={() => router.push("/tvarkarastis")}
      cancel={
        <Link href="/tvarkarastis" className={btn.ghost}>
          Atšaukti
        </Link>
      }
    />
  );
}
