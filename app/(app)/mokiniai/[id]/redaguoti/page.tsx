import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { DangerZone } from "@/components/students/danger-zone";
import { FormSkeleton } from "@/components/students/form-skeleton";
import { StudentForm } from "@/components/students/student-form";
import { formatTime } from "@/lib/students/constants";
import { loadFormContext } from "@/lib/students/form-context";
import { getStudent } from "@/lib/students/queries";

export const metadata: Metadata = { title: "Redaguoti mokinį" };

export default function RedaguotiPage({ params }: PageProps<"/mokiniai/[id]/redaguoti">) {
  return (
    <div className="mx-auto w-full max-w-[720px] animate-enter">
      <Suspense
        fallback={
          <>
            <PageHeader title="Redaguoti" />
            <FormSkeleton />
          </>
        }
      >
        <EditStudent params={params} />
      </Suspense>
    </div>
  );
}

async function EditStudent({ params }: { params: PageProps<"/mokiniai/[id]/redaguoti">["params"] }) {
  const { id } = await params;
  const [student, context] = await Promise.all([getStudent(id), loadFormContext(id)]);
  if (!student) notFound();

  const openSlots = student.schedule_slots
    .filter((s) => s.valid_to === null)
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
    .map((s) => ({ weekday: s.weekday, start_time: formatTime(s.start_time) }));

  return (
    <>
      <PageHeader
        clampTitle
        title={
          <>
            Redaguoti <em>{student.first_name}</em>
          </>
        }
      />
      <StudentForm
        key={student.status}
        mode="edit"
        studentId={student.id}
        usedTones={context.usedTones}
        otherSlots={context.otherSlots}
        today={context.today}
        initial={{
          first_name: student.first_name,
          last_name: student.last_name ?? "",
          grade: student.grade,
          math_level: student.math_level,
          status: student.status,
          price: String(Number(student.price)).replace(".", ","),
          tone: student.tone,
          meet_url: student.meet_url ?? "",
          board_url: student.board_url ?? "",
          student_phone: student.student_phone ?? "",
          student_email: student.student_email ?? "",
          parent_name: student.parent_name ?? "",
          parent_phone: student.parent_phone ?? "",
          parent_email: student.parent_email ?? "",
          notes: student.notes ?? "",
          slots: openSlots,
        }}
      />
      <DangerZone studentId={student.id} firstName={student.first_name} archived={student.status === "archyvuotas"} />
    </>
  );
}
