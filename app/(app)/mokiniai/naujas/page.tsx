import type { Metadata } from "next";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/students/form-skeleton";
import { PageHeader } from "@/components/page-header";
import { StudentForm } from "@/components/students/student-form";
import { freeTone } from "@/lib/students/constants";
import { loadFormContext } from "@/lib/students/form-context";

export const metadata: Metadata = { title: "Naujas mokinys" };

export default function NaujasMokinysPage() {
  return (
    <div className="mx-auto w-full max-w-[720px] animate-enter">
      <PageHeader
        title={
          <>
            Naujas <em>mokinys</em>
          </>
        }
        subtitle="Užpildyk tai, ką žinai – kontaktus ir nuorodas galima pridėti vėliau"
      />
      <Suspense fallback={<FormSkeleton />}>
        <NewStudentForm />
      </Suspense>
    </div>
  );
}

async function NewStudentForm() {
  const { usedTones, otherSlots, today } = await loadFormContext();
  return (
    <StudentForm
      mode="create"
      usedTones={usedTones}
      otherSlots={otherSlots}
      today={today}
      initial={{
        first_name: "",
        last_name: "",
        grade: 11,
        math_level: "A",
        status: "derinama",
        price: "25",
        tone: freeTone(usedTones),
        meet_url: "",
        board_url: "",
        student_phone: "",
        student_email: "",
        parent_name: "",
        parent_phone: "",
        parent_email: "",
        notes: "",
        slots: [],
      }}
    />
  );
}
