import { createClient } from "@/lib/supabase/server";

// Keeping lessons in step with weekly slots – used by the student Server Actions.
// Not a "use server" module on purpose: these are not callable from the browser.

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Removes a slot's untouched future lessons from `fromDate` on (SQL prune_planned_lessons):
 * only planned, not moved, future lessons without notes. Past, cancelled and moved ones stay.
 */
export async function pruneSlotLessons(supabase: Supabase, slotId: string, fromDate: string) {
  const { error } = await supabase.rpc("prune_planned_lessons", { p_slot_id: slotId, p_from: fromDate });
  if (error) throw new Error(`prune_planned_lessons: ${error.message}`);
}

/** Future planned lessons follow a new price; past (held) lessons keep their snapshot. */
export async function repriceFutureLessons(supabase: Supabase, studentId: string, price: number) {
  const { error } = await supabase
    .from("lessons")
    .update({ price })
    .eq("student_id", studentId)
    .eq("status", "suplanuota")
    .gt("starts_at", new Date().toISOString());
  if (error) throw new Error(`repriceFutureLessons: ${error.message}`);
}
