import type { Database } from "@/lib/supabase/database.types";

// Shared by server and client code.

export type LessonStatus = Database["public"]["Enums"]["lesson_status"];

/** Chalk counts lessons from this day on (project decision, 2026-10-21). Nothing is generated or added before it. */
export const LESSONS_START = "2026-10-21";

export const LESSON_STATUS: Record<LessonStatus, { label: string; pill: string }> = {
  suplanuota: { label: "Suplanuota", pill: "bg-muted text-muted-foreground" },
  ivyko: { label: "Įvyko", pill: "bg-sage-tint text-sage-ink" },
  atsaukta: { label: "Atšaukta", pill: "bg-coral-tint text-coral-ink" },
};
