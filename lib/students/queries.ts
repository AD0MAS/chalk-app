import { createClient } from "@/lib/supabase/server";
import type { StudentStatus, StudentTone } from "./constants";

// Read-only queries for student screens. They run on the server at request time
// (createClient awaits connection()), so callers must sit inside <Suspense>.
// RLS makes sure only Adomas's own rows come back.

export async function listStudents() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, first_name, last_name, grade, math_level, status, price, tone, schedule_slots (id, weekday, start_time, valid_from, valid_to)"
    )
    .order("first_name");
  if (error) throw new Error(`Nepavyko įkelti mokinių: ${error.message}`);
  return data;
}

export type StudentListItem = Awaited<ReturnType<typeof listStudents>>[number];

export async function getStudent(id: string) {
  // Not a valid id → treat as "not found" instead of a database error.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("*, schedule_slots (*), student_status_history (*), gaps (*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Nepavyko įkelti mokinio: ${error.message}`);
  return data;
}

export type StudentDetail = NonNullable<Awaited<ReturnType<typeof getStudent>>>;

/** How many students per status – for the Mokiniai tabs and navbar tiles. */
export async function countStudentsByStatus() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("students").select("status");
  if (error) throw new Error(`Nepavyko suskaičiuoti mokinių: ${error.message}`);
  const counts: Record<StudentStatus | "visi", number> = {
    visi: 0,
    derinama: 0,
    pastovus: 0,
    nepastovus: 0,
    pauze: 0,
    archyvuotas: 0,
  };
  for (const row of data) {
    counts[row.status] += 1;
    if (row.status !== "archyvuotas") counts.visi += 1;
  }
  return counts;
}

export type StudentCounts = Awaited<ReturnType<typeof countStudentsByStatus>>;

/** Tones already used by active (non-archived) students, so a new student gets a free one. */
export async function usedTones(exceptStudentId?: string): Promise<StudentTone[]> {
  const supabase = await createClient();
  let query = supabase.from("students").select("id, tone").neq("status", "archyvuotas");
  if (exceptStudentId) query = query.neq("id", exceptStudentId);
  const { data, error } = await query;
  if (error) throw new Error(`Nepavyko įkelti spalvų: ${error.message}`);
  return data.map((r) => r.tone);
}
