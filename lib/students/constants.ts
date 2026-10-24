import type { Database } from "@/lib/supabase/database.types";

// Shared by server and client code: labels, colours and small formatting helpers for students.

export type StudentStatus = Database["public"]["Enums"]["student_status"];
export type MathLevel = Database["public"]["Enums"]["math_level"];
export type StudentTone = Database["public"]["Enums"]["student_tone"];

export const STATUSES: { value: StudentStatus; label: string; tab: string }[] = [
  { value: "pastovus", label: "Pastovus", tab: "Pastovūs" },
  { value: "nepastovus", label: "Nepastovus", tab: "Nepastovūs" },
  { value: "derinama", label: "Derinama", tab: "Derinama" },
  { value: "pauze", label: "Pauzė", tab: "Pauzė" },
  { value: "archyvuotas", label: "Archyvuotas", tab: "Archyvas" },
];

export const statusLabel = (s: StudentStatus) => STATUSES.find((x) => x.value === s)?.label ?? s;

// DESIGN.md §5 semantic mapping (tint background + ink text, small pills only).
export const STATUS_PILL: Record<StudentStatus, string> = {
  derinama: "bg-sand-tint text-sand-ink",
  pastovus: "bg-sky-tint text-sky-ink",
  nepastovus: "bg-lavender-tint text-lavender-ink",
  pauze: "bg-slate-tint text-slate-ink",
  archyvuotas: "bg-muted text-muted-foreground",
};

// The 12 tones from DESIGN.md §5. Class names are written out so Tailwind can find them.
export const TONES: { value: StudentTone; label: string; dot: string; block: string }[] = [
  { value: "sky", label: "Sky", dot: "bg-sky", block: "bg-sky-tint text-sky-ink" },
  { value: "sage", label: "Sage", dot: "bg-sage", block: "bg-sage-tint text-sage-ink" },
  { value: "clay", label: "Clay", dot: "bg-clay", block: "bg-clay-tint text-clay-ink" },
  { value: "lavender", label: "Lavender", dot: "bg-lavender", block: "bg-lavender-tint text-lavender-ink" },
  { value: "sand", label: "Sand", dot: "bg-sand", block: "bg-sand-tint text-sand-ink" },
  { value: "rose", label: "Rose", dot: "bg-rose", block: "bg-rose-tint text-rose-ink" },
  { value: "mist", label: "Mist", dot: "bg-mist", block: "bg-mist-tint text-mist-ink" },
  { value: "apricot", label: "Apricot", dot: "bg-apricot", block: "bg-apricot-tint text-apricot-ink" },
  { value: "plum", label: "Plum", dot: "bg-plum", block: "bg-plum-tint text-plum-ink" },
  { value: "slate", label: "Slate", dot: "bg-slate", block: "bg-slate-tint text-slate-ink" },
  { value: "moss", label: "Moss", dot: "bg-moss", block: "bg-moss-tint text-moss-ink" },
  { value: "coral", label: "Coral", dot: "bg-coral", block: "bg-coral-tint text-coral-ink" },
];

export const toneDot = (t: StudentTone) => TONES.find((x) => x.value === t)?.dot ?? "bg-sky";

/** Lesson blocks in the week view: tint background + ink text (DESIGN.md §5 – blocks may use the tone). */
export const toneBlock = (t: StudentTone) => TONES.find((x) => x.value === t)?.block ?? "bg-sky-tint text-sky-ink";

/** First of the 12 tones that no active (non-archived) student uses yet. */
export function freeTone(used: StudentTone[]): StudentTone {
  return TONES.find((t) => !used.includes(t.value))?.value ?? "sky";
}

// ISO weekdays: 1 = Monday … 7 = Sunday.
export const WEEKDAYS: { value: number; short: string; long: string }[] = [
  { value: 1, short: "Pirm", long: "Pirmadienis" },
  { value: 2, short: "Antr", long: "Antradienis" },
  { value: 3, short: "Treč", long: "Trečiadienis" },
  { value: 4, short: "Ketv", long: "Ketvirtadienis" },
  { value: 5, short: "Penkt", long: "Penktadienis" },
  { value: 6, short: "Šešt", long: "Šeštadienis" },
  { value: 7, short: "Sekm", long: "Sekmadienis" },
];

export const weekdayShort = (d: number) => WEEKDAYS.find((w) => w.value === d)?.short ?? "?";
export const weekdayLong = (d: number) => WEEKDAYS.find((w) => w.value === d)?.long ?? "?";

/** "12 kl B", "11 kl A", "7 kl" (SPEC §1). */
export function formatGrade(grade: number, level: MathLevel | null) {
  return grade >= 11 ? `${grade} kl ${level ?? "A"}` : `${grade} kl`;
}

/** "18:00:00" → "18:00" */
export const formatTime = (t: string) => t.slice(0, 5);

/** 25 → "25 €", 22.5 → "22,50 €" */
export function formatEur(amount: number) {
  const whole = Number.isInteger(amount);
  return `${amount.toLocaleString("lt-LT", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })} €`;
}

export type SlotLike = { weekday: number; start_time: string };

/** "Antr 18:00 · Ketv 18:00" */
export function formatSchedule(slots: SlotLike[]) {
  return [...slots]
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
    .map((s) => `${weekdayShort(s.weekday)} ${formatTime(s.start_time)}`)
    .join(" · ");
}

/** Today's date (YYYY-MM-DD) in Europe/Vilnius. Call only at request time. */
export function todayInVilnius(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vilnius" }).format(now);
}

/** A slot is current on `date` if it started on or before it and has not ended. */
export function isSlotActive(slot: { valid_from: string; valid_to: string | null }, date: string) {
  return slot.valid_from <= date && (slot.valid_to === null || slot.valid_to >= date);
}
