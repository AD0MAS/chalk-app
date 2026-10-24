import type { OtherSlot } from "@/components/students/student-form";
import { isSlotActive, todayInVilnius, type StudentTone } from "./constants";
import { listStudents } from "./queries";

/** What the student form needs besides the student itself: free tones, other students' slots, today. */
export async function loadFormContext(exceptStudentId?: string) {
  const students = await listStudents();
  const today = todayInVilnius();
  const others = students.filter((s) => s.id !== exceptStudentId && s.status !== "archyvuotas");

  const usedTones: StudentTone[] = others.map((s) => s.tone);
  const otherSlots: OtherSlot[] = others.flatMap((s) =>
    s.schedule_slots
      .filter((slot) => isSlotActive(slot, today) || (slot.valid_from > today && slot.valid_to === null))
      .map((slot) => ({ weekday: slot.weekday, start_time: slot.start_time, name: s.first_name }))
  );

  return { usedTones, otherSlots, today };
}
