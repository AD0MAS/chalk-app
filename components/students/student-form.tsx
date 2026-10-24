"use client";

import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useId, useState } from "react";
import { createStudent, updateStudent, type FormState } from "@/lib/students/actions";
import {
  STATUSES,
  TONES,
  WEEKDAYS,
  formatGrade,
  weekdayLong,
  type MathLevel,
  type StudentStatus,
  type StudentTone,
} from "@/lib/students/constants";
import { btn, card, field, label, segment, segmentItem, textarea } from "@/lib/ui";
import { cn } from "@/lib/utils";

export type StudentFormValues = {
  first_name: string;
  last_name: string;
  grade: number;
  math_level: MathLevel | null;
  status: StudentStatus;
  price: string;
  tone: StudentTone;
  meet_url: string;
  board_url: string;
  student_phone: string;
  student_email: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  notes: string;
  slots: { weekday: number; start_time: string }[];
};

/** Other students' current weekly slots – used to warn about overlaps. */
export type OtherSlot = { weekday: number; start_time: string; name: string };

type SlotRow = { id: number; weekday: number; start_time: string };

export function StudentForm({
  mode,
  studentId,
  initial,
  usedTones,
  otherSlots,
  today,
}: {
  mode: "create" | "edit";
  studentId?: string;
  initial: StudentFormValues;
  usedTones: StudentTone[];
  otherSlots: OtherSlot[];
  today: string;
}) {
  const action = mode === "create" ? createStudent : updateStudent.bind(null, studentId!);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const errors = (state && "errors" in state && state.errors) || {};
  const message = state && "message" in state ? state.message : undefined;

  const [firstName, setFirstName] = useState(initial.first_name);
  const [grade, setGrade] = useState(initial.grade);
  const [level, setLevel] = useState<MathLevel>(initial.math_level ?? "A");
  const [status, setStatus] = useState<StudentStatus>(initial.status);
  const [tone, setTone] = useState<StudentTone>(initial.tone);
  const [slots, setSlots] = useState<SlotRow[]>(() => initial.slots.map((s, i) => ({ id: i, ...s })));
  const [nextId, setNextId] = useState(initial.slots.length);

  const statuses = STATUSES.filter((s) => s.value !== "archyvuotas" || initial.status === "archyvuotas");

  function addSlot() {
    const last = slots.at(-1);
    setSlots([...slots, { id: nextId, weekday: last ? Math.min(last.weekday + 2, 7) : 2, start_time: last?.start_time ?? "18:00" }]);
    setNextId(nextId + 1);
  }

  const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const conflicts = slots.flatMap((s) =>
    otherSlots
      .filter((o) => o.weekday === s.weekday && Math.abs(toMinutes(o.start_time) - toMinutes(s.start_time)) < 60)
      .map((o) => `${weekdayLong(s.weekday)} ${s.start_time} kertasi su ${o.name} (${o.start_time.slice(0, 5)})`)
  );

  const summary = [firstName.trim() || "Naujas mokinys", formatGrade(grade, level), slots.length ? `${slots.length} laik.` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <form
      // onSubmit instead of action={…}: React would reset all fields after the action,
      // so a validation error would wipe what Adomas typed.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="slots" value={JSON.stringify(slots.map(({ weekday, start_time }) => ({ weekday, start_time })))} />

      {/* --- Pagrindinė informacija --- */}
      <Section title="Pagrindinė informacija">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="first_name" label="Vardas" error={errors.first_name}>
            <input
              id="first_name"
              name="first_name"
              required
              maxLength={80}
              autoComplete="off"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              aria-invalid={errors.first_name ? true : undefined}
              className={field}
            />
          </Field>
          <Field id="last_name" label="Pavardė" hint="neprivaloma" error={errors.last_name}>
            <input id="last_name" name="last_name" maxLength={80} autoComplete="off" defaultValue={initial.last_name} className={field} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="grade" label="Klasė" error={errors.grade}>
            <select id="grade" name="grade" value={grade} onChange={(e) => setGrade(Number(e.target.value))} className={cn(field, "px-3")}>
              {[5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                <option key={g} value={g}>
                  {g} kl
                </option>
              ))}
            </select>
          </Field>

          {grade >= 11 ? (
            <fieldset className="flex flex-col gap-1.5">
              <legend className={cn(label, "mb-1.5")}>Matematikos lygis</legend>
              <div className={segment}>
                {(["A", "B"] as const).map((l) => (
                  <label key={l} className={segmentItem}>
                    <input type="radio" name="math_level" value={l} checked={level === l} onChange={() => setLevel(l)} className="sr-only" />
                    {l}
                  </label>
                ))}
              </div>
              <span className="text-[13px] text-muted-foreground">Nežinant – A</span>
            </fieldset>
          ) : (
            <div className="hidden sm:block" />
          )}

          <Field id="price" label="Kaina už pamoką" error={errors.price}>
            <div className={cn(field, "flex items-center gap-2 focus-within:shadow-[inset_0_0_0_1px_rgba(3,3,2,.3),0_0_0_3px_rgba(3,3,2,.08)]")}>
              <input
                id="price"
                name="price"
                inputMode="decimal"
                defaultValue={initial.price}
                aria-invalid={errors.price ? true : undefined}
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
              <span className="shrink-0 text-muted-foreground">€ / 60 min</span>
            </div>
          </Field>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className={cn(label, "mb-2")}>Statusas</legend>
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => (
              <label
                key={s.value}
                className={cn(
                  "inline-flex h-10 cursor-pointer items-center rounded-pill px-4 text-sm font-medium transition-all duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foreground/40",
                  status === s.value ? "bg-primary text-primary-foreground" : "bg-card shadow-[inset_0_0_0_1px_var(--input)] hover:bg-background"
                )}
              >
                <input type="radio" name="status" value={s.value} checked={status === s.value} onChange={() => setStatus(s.value)} className="sr-only" />
                {s.label}
              </label>
            ))}
          </div>
          {errors.status ? <ErrorText>{errors.status}</ErrorText> : null}
        </fieldset>
      </Section>

      {/* --- Savaitinis tvarkaraštis --- */}
      <Section title="Savaitinis tvarkaraštis" aside={slots.length ? `${slots.length} per savaitę` : "laikai dar nesutarti"}>
        {slots.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <div aria-hidden="true" className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_44px] gap-2.5 text-[13px] font-medium text-muted-foreground sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_88px_44px]">
              <span>Savaitės diena</span>
              <span>Pradžia</span>
              <span className="hidden sm:block">Trukmė</span>
              <span />
            </div>
            {slots.map((slot, i) => (
              <div key={slot.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_44px] items-center gap-2.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_88px_44px]">
                <select
                  aria-label={`Savaitės diena, ${i + 1} laikas`}
                  value={slot.weekday}
                  onChange={(e) => setSlots(slots.map((s) => (s.id === slot.id ? { ...s, weekday: Number(e.target.value) } : s)))}
                  className={cn(field, "px-3")}
                >
                  {WEEKDAYS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.long}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  step={300}
                  aria-label={`Pradžia, ${i + 1} laikas`}
                  value={slot.start_time}
                  onChange={(e) => setSlots(slots.map((s) => (s.id === slot.id ? { ...s, start_time: e.target.value } : s)))}
                  className={cn(field, "tabular-nums")}
                />
                <span className="hidden h-9 items-center justify-center rounded-pill bg-muted text-sm text-foreground/80 sm:flex">60 min</span>
                <button
                  type="button"
                  aria-label={`Pašalinti ${i + 1} laiką`}
                  onClick={() => setSlots(slots.filter((s) => s.id !== slot.id))}
                  className={cn(btn.ghost, "size-11 px-0 text-muted-foreground")}
                >
                  <Trash2 aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}

        {conflicts.length > 0 && (
          <div role="alert" className="flex gap-2 rounded-input bg-sand-tint px-3 py-2.5 text-[13px] leading-[18px] text-sand-ink">
            <AlertTriangle aria-hidden="true" className="mt-px size-4 shrink-0" strokeWidth={1.75} />
            <ul className="min-w-0">
              {conflicts.map((c) => (
                <li key={c} className="[overflow-wrap:anywhere]">{c}</li>
              ))}
            </ul>
          </div>
        )}
        {errors.slots ? <ErrorText>{errors.slots}</ErrorText> : null}

        <button type="button" onClick={addSlot} className={cn(btn.small, "self-start")}>
          <Plus aria-hidden="true" className="size-3.5" strokeWidth={2} />
          Pridėti laiką
        </button>

        <div className="grid items-end gap-4 border-t pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Field id="effective_from" label="Galioja nuo" error={errors.effective_from}>
            <input id="effective_from" name="effective_from" type="date" defaultValue={today} required className={cn(field, "tabular-nums")} />
          </Field>
          <p className="pb-1 text-[13px] leading-[18px] text-muted-foreground">
            Nuo šios datos galios {mode === "edit" ? "laikų ir statuso pakeitimai – ankstesni lieka istorijoje" : "laikai ir statusas"}.
          </p>
        </div>
      </Section>

      {/* --- Nuorodos ir spalva --- */}
      <Section title="Nuorodos ir spalva">
        <Field id="meet_url" label="Google Meet nuoroda" hint="pastovi" error={errors.meet_url}>
          <input id="meet_url" name="meet_url" type="url" inputMode="url" placeholder="https://meet.google.com/…" defaultValue={initial.meet_url} aria-invalid={errors.meet_url ? true : undefined} className={field} />
        </Field>
        <Field id="board_url" label="tldraw lentos nuoroda" hint="pastovi" error={errors.board_url}>
          <div className="flex gap-2 max-sm:flex-col">
            <input id="board_url" name="board_url" type="url" inputMode="url" placeholder="https://www.tldraw.com/f/…" defaultValue={initial.board_url} aria-invalid={errors.board_url ? true : undefined} className={field} />
            <a href="https://www.tldraw.com/" target="_blank" rel="noopener noreferrer" className={cn(btn.secondary, "h-12 max-sm:self-start")}>
              Nauja lenta
            </a>
          </div>
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className={cn(label, "mb-2")}>
            Spalva <span className="font-normal text-muted-foreground">· pamokų kortelėms ir kalendoriui</span>
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {TONES.map((t) => {
              const used = usedTones.includes(t.value) && t.value !== initial.tone;
              const selected = tone === t.value;
              return (
                <label
                  key={t.value}
                  title={used ? `${t.label} – jau naudojama` : t.label}
                  className={cn(
                    "size-8 cursor-pointer rounded-pill transition-all duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-foreground/40",
                    t.dot,
                    used && !selected && "opacity-35",
                    selected && "shadow-[0_0_0_3px_var(--card),0_0_0_4.5px_var(--foreground)]"
                  )}
                >
                  <input type="radio" name="tone" value={t.value} checked={selected} onChange={() => setTone(t.value)} className="sr-only" />
                  <span className="sr-only">
                    {t.label}
                    {used ? " (jau naudojama)" : ""}
                  </span>
                </label>
              );
            })}
          </div>
          <span className="text-[13px] text-muted-foreground">
            {mode === "create" ? "Parinkta laisva spalva. " : ""}Užimtos rodomos blankiau.
          </span>
        </fieldset>
      </Section>

      {/* --- Kontaktai --- */}
      <Section title="Kontaktai">
        <span className="-mb-1.5 text-[13px] font-medium text-muted-foreground">Mokinys</span>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="student_phone" label="Telefonas">
            <input id="student_phone" name="student_phone" type="tel" autoComplete="off" placeholder="+370 6xx xxxxx" defaultValue={initial.student_phone} className={field} />
          </Field>
          <Field id="student_email" label="El. paštas" error={errors.student_email}>
            <input id="student_email" name="student_email" type="email" autoComplete="off" defaultValue={initial.student_email} aria-invalid={errors.student_email ? true : undefined} className={field} />
          </Field>
        </div>
        <span className="-mb-1.5 text-[13px] font-medium text-muted-foreground">Tėvai</span>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="parent_name" label="Vardas">
            <input id="parent_name" name="parent_name" autoComplete="off" defaultValue={initial.parent_name} className={field} />
          </Field>
          <Field id="parent_phone" label="Telefonas">
            <input id="parent_phone" name="parent_phone" type="tel" autoComplete="off" defaultValue={initial.parent_phone} className={field} />
          </Field>
          <Field id="parent_email" label="El. paštas" error={errors.parent_email}>
            <input id="parent_email" name="parent_email" type="email" autoComplete="off" defaultValue={initial.parent_email} aria-invalid={errors.parent_email ? true : undefined} className={field} />
          </Field>
        </div>
      </Section>

      {/* --- Apie mokinį --- */}
      <section className={cn(card, "flex flex-col gap-2.5 p-6")}>
        <label htmlFor="notes" className="font-serif text-2xl leading-[1.1] tracking-[-0.02em]">
          Apie mokinį
        </label>
        <textarea id="notes" name="notes" rows={4} placeholder="Tikslai, stiprybės, kas padeda…" defaultValue={initial.notes} className={textarea} />
      </section>

      {/* --- Sticky actions --- */}
      <div className="glass-border sticky bottom-6 z-10 flex items-center gap-2 rounded-pill py-2 pr-2 pl-5 shadow-glass backdrop-blur-[12px]" style={{ background: "var(--navbar-gradient)" }}>
        {/* The summary only fits on wider screens; an error message is always shown */}
        <span className={cn("truncate-name text-sm text-muted-foreground", !message && "max-sm:hidden")}>
          {message ? <span role="alert" className="text-coral-ink">{message}</span> : summary}
        </span>
        <Link href={mode === "edit" ? `/mokiniai/${studentId}` : "/mokiniai"} className={cn(btn.ghost, "ml-auto")}>
          Atšaukti
        </Link>
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending ? "Saugoma…" : mode === "create" ? "Išsaugoti mokinį" : "Išsaugoti"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn(card, "flex flex-col gap-4 p-6 max-sm:p-5")}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-serif text-2xl leading-[1.1] tracking-[-0.02em]">
          {title}
        </h2>
        {aside ? <span className="shrink-0 text-[13px] text-muted-foreground">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Field({ id, label: text, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={label}>
        {text}
        {hint ? <span className="font-normal text-muted-foreground"> · {hint}</span> : null}
      </label>
      {children}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] text-coral-ink">{children}</span>;
}
