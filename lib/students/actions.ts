"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { scheduleSync } from "@/lib/google/sync";
import { ensureLessons } from "@/lib/lessons/queries";
import { pruneSlotLessons, repriceFutureLessons } from "@/lib/lessons/slots";
import { createClient } from "@/lib/supabase/server";
import { STATUSES, TONES, todayInVilnius, type MathLevel, type StudentStatus, type StudentTone } from "./constants";

// Server Actions for students. Every write goes through RLS (owner only).

export type FormState = { ok?: false; errors?: Record<string, string>; message?: string } | { ok: true };

type SlotInput = { weekday: number; start_time: string };

type StudentInput = {
  first_name: string;
  last_name: string | null;
  grade: number;
  math_level: MathLevel | null;
  status: StudentStatus;
  price: number;
  tone: StudentTone;
  meet_url: string | null;
  board_url: string | null;
  student_phone: string | null;
  student_email: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  notes: string | null;
};

/* ---------------- validation ---------------- */

const text = (fd: FormData, key: string) => {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? null : v;
};

function normalizeUrl(value: string | null): string | null | "invalid" {
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "invalid";
  } catch {
    return "invalid";
  }
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

function parseForm(fd: FormData) {
  const errors: Record<string, string> = {};

  const first_name = text(fd, "first_name") ?? "";
  if (!first_name) errors.first_name = "Įrašyk vardą.";
  else if (first_name.length > 80) errors.first_name = "Per ilgas vardas.";

  const last_name = text(fd, "last_name");
  if (last_name && last_name.length > 80) errors.last_name = "Per ilga pavardė.";

  const grade = Number(fd.get("grade"));
  if (!Number.isInteger(grade) || grade < 5 || grade > 12) errors.grade = "Klasė turi būti nuo 5 iki 12.";

  const levelRaw = text(fd, "math_level");
  const math_level: MathLevel | null = grade >= 11 ? (levelRaw === "B" ? "B" : "A") : null;

  const statusRaw = text(fd, "status");
  const status = STATUSES.find((s) => s.value === statusRaw)?.value;
  if (!status) errors.status = "Pasirink statusą.";

  const priceRaw = (text(fd, "price") ?? "").replace(",", ".");
  const price = Number(priceRaw);
  if (!priceRaw || Number.isNaN(price) || price < 0 || price > 1000) errors.price = "Įrašyk kainą eurais, pvz. 25.";

  const toneRaw = text(fd, "tone");
  const tone = TONES.find((t) => t.value === toneRaw)?.value ?? "sky";

  const meet_url = normalizeUrl(text(fd, "meet_url"));
  if (meet_url === "invalid") errors.meet_url = "Neteisinga nuoroda.";
  const board_url = normalizeUrl(text(fd, "board_url"));
  if (board_url === "invalid") errors.board_url = "Neteisinga nuoroda.";

  const student_email = text(fd, "student_email");
  if (student_email && !isEmail(student_email)) errors.student_email = "Neteisingas el. paštas.";
  const parent_email = text(fd, "parent_email");
  if (parent_email && !isEmail(parent_email)) errors.parent_email = "Neteisingas el. paštas.";

  const effective_from = text(fd, "effective_from") ?? "";
  if (!isDate(effective_from)) errors.effective_from = "Pasirink datą.";

  let slots: SlotInput[] = [];
  try {
    const raw = JSON.parse(String(fd.get("slots") ?? "[]")) as SlotInput[];
    const seen = new Set<string>();
    for (const s of raw) {
      const weekday = Number(s.weekday);
      const time = String(s.start_time ?? "");
      if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        errors.slots = "Patikrink savaitės dieną ir laiką (pvz. 18:00).";
        continue;
      }
      const key = `${weekday}-${time}`;
      if (seen.has(key)) continue; // same time twice – keep one
      seen.add(key);
      slots.push({ weekday, start_time: time });
    }
  } catch {
    errors.slots = "Nepavyko perskaityti laikų.";
  }
  if (slots.length > 14) errors.slots = "Per daug laikų.";
  slots = slots.sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));

  const data: StudentInput = {
    first_name,
    last_name,
    grade,
    math_level,
    status: status ?? "derinama",
    price,
    tone,
    meet_url: meet_url === "invalid" ? null : meet_url,
    board_url: board_url === "invalid" ? null : board_url,
    student_phone: text(fd, "student_phone"),
    student_email,
    parent_name: text(fd, "parent_name"),
    parent_phone: text(fd, "parent_phone"),
    parent_email,
    notes: text(fd, "notes"),
  };

  return { data, slots, effective_from, errors };
}

function dayBefore(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const SAVE_FAILED = "Nepavyko išsaugoti. Pabandyk dar kartą.";

/* ---------------- create / update ---------------- */

export async function createStudent(_prev: FormState, fd: FormData): Promise<FormState> {
  const { data, slots, effective_from, errors } = parseForm(fd);
  if (Object.keys(errors).length) return { errors };

  const supabase = await createClient();
  const { data: student, error } = await supabase.from("students").insert(data).select("id").single();
  if (error || !student) {
    console.error("createStudent:", error?.message);
    return { message: SAVE_FAILED };
  }

  const history = await supabase
    .from("student_status_history")
    .insert({ student_id: student.id, status: data.status, valid_from: effective_from });
  const slotRows = slots.map((s) => ({ ...s, student_id: student.id, valid_from: effective_from }));
  const slotsResult = slotRows.length ? await supabase.from("schedule_slots").insert(slotRows) : { error: null };
  if (history.error || slotsResult.error) {
    console.error("createStudent history/slots:", history.error?.message, slotsResult.error?.message);
    return { message: "Mokinys sukurtas, bet nepavyko išsaugoti laikų ar statuso istorijos. Atidaryk ir išsaugok dar kartą." };
  }

  await ensureLessons(supabase);
  scheduleSync();
  revalidatePath("/", "layout");
  redirect(`/mokiniai/${student.id}`);
}

export async function updateStudent(studentId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { data, slots, effective_from, errors } = parseForm(fd);
  if (Object.keys(errors).length) return { errors };

  const supabase = await createClient();
  const { data: current, error: loadError } = await supabase
    .from("students")
    .select("status, price, schedule_slots (id, weekday, start_time, valid_from, valid_to)")
    .eq("id", studentId)
    .single();
  if (loadError || !current) return { message: "Mokinys nerastas." };

  const { error } = await supabase.from("students").update(data).eq("id", studentId);
  if (error) {
    console.error("updateStudent:", error.message);
    return { message: SAVE_FAILED };
  }

  // Status change → history row.
  if (current.status !== data.status) {
    const { error: hErr } = await supabase
      .from("student_status_history")
      .insert({ student_id: studentId, status: data.status, valid_from: effective_from });
    if (hErr) return { message: SAVE_FAILED };
  }

  // Weekly slots: keep unchanged ones, close removed ones, open new ones – all from `effective_from`.
  // Lessons follow safely: only untouched future lessons of a closed slot are removed
  // (never past, cancelled or moved ones), then lessons are regenerated from the new slots.
  const open = current.schedule_slots.filter((s) => s.valid_to === null);
  const key = (s: SlotInput) => `${s.weekday}-${s.start_time.slice(0, 5)}`;
  const wanted = new Set(slots.map(key));
  const existing = new Set(open.map(key));

  try {
    for (const slot of open) {
      if (wanted.has(key(slot))) continue;
      // A slot that would end before it starts was never really used → remove it.
      const neverStarted = slot.valid_from >= effective_from;
      await pruneSlotLessons(supabase, slot.id, neverStarted ? slot.valid_from : effective_from);
      const result = neverStarted
        ? await supabase.from("schedule_slots").delete().eq("id", slot.id)
        : await supabase.from("schedule_slots").update({ valid_to: dayBefore(effective_from) }).eq("id", slot.id);
      if (result.error) return { message: SAVE_FAILED };
    }

    const toAdd = slots
      .filter((s) => !existing.has(key(s)))
      .map((s) => ({ ...s, student_id: studentId, valid_from: effective_from }));
    if (toAdd.length) {
      const { error: sErr } = await supabase.from("schedule_slots").insert(toAdd);
      if (sErr) return { message: SAVE_FAILED };
    }

    // Pauzė / archive: no new lessons are generated; the planned ones from `effective_from` go away.
    // (Every slot still running on that date – also ones that end later.)
    if (data.status === "pauze" || data.status === "archyvuotas") {
      const running = current.schedule_slots.filter((s) => s.valid_to === null || s.valid_to >= effective_from);
      for (const slot of running) await pruneSlotLessons(supabase, slot.id, effective_from);
    }
    if (Number(current.price) !== data.price) await repriceFutureLessons(supabase, studentId, data.price);
    await ensureLessons(supabase);
  } catch (e) {
    console.error("updateStudent lessons:", e instanceof Error ? e.message : e);
    return { message: "Mokinys išsaugotas, bet nepavyko atnaujinti pamokų. Išsaugok dar kartą." };
  }

  scheduleSync();
  revalidatePath("/", "layout");
  redirect(`/mokiniai/${studentId}`);
}

/* ---------------- archive / delete ---------------- */

export async function setArchived(studentId: string, archived: boolean) {
  const supabase = await createClient();
  let status: StudentStatus = "archyvuotas";

  if (!archived) {
    // Back to the status the student had before archiving (or Pauzė if unknown).
    const { data } = await supabase
      .from("student_status_history")
      .select("status")
      .eq("student_id", studentId)
      .neq("status", "archyvuotas")
      .order("valid_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);
    status = data?.[0]?.status ?? "pauze";
  }

  const { error } = await supabase.from("students").update({ status }).eq("id", studentId);
  if (error) throw new Error(SAVE_FAILED);
  await supabase
    .from("student_status_history")
    .insert({ student_id: studentId, status, valid_from: todayInVilnius() });

  // Archived → its untouched future lessons go away; back from the archive → regenerated.
  if (archived) {
    const today = todayInVilnius();
    const { data: slots } = await supabase
      .from("schedule_slots")
      .select("id")
      .eq("student_id", studentId)
      .or(`valid_to.is.null,valid_to.gte.${today}`);
    for (const slot of slots ?? []) await pruneSlotLessons(supabase, slot.id, today);
  } else {
    await ensureLessons(supabase);
  }

  scheduleSync();
  revalidatePath("/", "layout");
}

/** Permanent delete – only if the typed name matches exactly. Everything of this student goes. */
export async function deleteStudent(studentId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: student } = await supabase.from("students").select("first_name").eq("id", studentId).single();
  if (!student) return { message: "Mokinys nerastas." };

  const typed = String(fd.get("confirm") ?? "").trim();
  if (typed !== student.first_name.trim()) {
    return { errors: { confirm: `Įrašyk tiksliai: ${student.first_name}` } };
  }

  const { error } = await supabase.from("students").delete().eq("id", studentId);
  if (error) {
    console.error("deleteStudent:", error.message);
    return { message: "Nepavyko ištrinti." };
  }

  scheduleSync();
  revalidatePath("/", "layout");
  redirect("/mokiniai");
}

/* ---------------- gaps (spragos) ---------------- */

export async function addGap(studentId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const value = String(fd.get("text") ?? "").trim();
  if (!value) return { errors: { text: "Įrašyk spragą." } };
  if (value.length > 200) return { errors: { text: "Per ilga (iki 200 simbolių)." } };

  const supabase = await createClient();
  const { error } = await supabase.from("gaps").insert({ student_id: studentId, text: value });
  if (error) return { message: SAVE_FAILED };

  revalidatePath(`/mokiniai/${studentId}`);
  return { ok: true };
}

export async function setGapResolved(studentId: string, gapId: string, resolved: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("gaps")
    .update({ resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", gapId);
  if (error) throw new Error(SAVE_FAILED);
  revalidatePath(`/mokiniai/${studentId}`);
}

export async function deleteGap(studentId: string, gapId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("gaps").delete().eq("id", gapId);
  if (error) throw new Error(SAVE_FAILED);
  revalidatePath(`/mokiniai/${studentId}`);
}
