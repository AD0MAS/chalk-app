import { matchStudent } from "@/lib/bank/import";
import { addDays, todayVilnius, vilniusParts } from "@/lib/lessons/time";
import { displayNames } from "@/lib/names";
import { formatGrade, type StudentTone } from "@/lib/students/constants";
import { createClient } from "@/lib/supabase/server";
import { OPENING_BALANCE_DATE, type PaymentSource } from "./constants";

// Read-only money queries. They run at request time (createClient awaits connection()),
// so callers must sit inside <Suspense>. RLS makes sure only Adomas's own rows come back.
// Every balance comes from the SQL view student_balances – one formula for every screen.

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Balance = { balance: number; paid: number; charged: number; held: number; opening: number };

/** Balance of every student, by student id. */
export async function getBalances(supabase?: Supabase) {
  const client = supabase ?? (await createClient());
  const { data, error } = await client.from("student_balances").select("*");
  if (error) throw new Error(`Nepavyko įkelti balansų: ${error.message}`);
  const map = new Map<string, Balance>();
  for (const r of data) {
    map.set(r.student_id!, {
      balance: Number(r.balance),
      paid: Number(r.paid),
      charged: Number(r.charged),
      held: r.held_count ?? 0,
      opening: Number(r.opening_balance),
    });
  }
  return map;
}

export async function getStudentBalance(studentId: string): Promise<Balance> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("student_balances").select("*").eq("student_id", studentId).maybeSingle();
  if (error) throw new Error(`Nepavyko įkelti balanso: ${error.message}`);
  return {
    balance: Number(data?.balance ?? 0),
    paid: Number(data?.paid ?? 0),
    charged: Number(data?.charged ?? 0),
    held: data?.held_count ?? 0,
    opening: Number(data?.opening_balance ?? 0),
  };
}

/** Students who owe money (balance < 0), biggest debt first, and the total – Šiandien "Skolos". */
export async function getDebts(supabase?: Supabase) {
  const client = supabase ?? (await createClient());
  const [balances, { data, error }] = await Promise.all([
    getBalances(client),
    client.from("students").select("id, first_name, last_name, status"),
  ]);
  if (error) throw new Error(`Nepavyko įkelti mokinių: ${error.message}`);
  const names = displayNames(data.filter((s) => s.status !== "archyvuotas").map((s) => ({ id: s.id, firstName: s.first_name, lastName: s.last_name })));
  const debtors = data
    .map((s) => ({ id: s.id, name: names.get(s.id) ?? s.first_name, balance: balances.get(s.id)?.balance ?? 0 }))
    .filter((s) => s.balance < 0)
    .sort((a, b) => a.balance - b.balance);
  return { total: -debtors.reduce((sum, s) => sum + s.balance, 0), debtors };
}

/* ---------------- payments ---------------- */

export type PaymentItem = {
  id: string;
  studentId: string | null;
  studentName: string | null; // display name
  studentTone: StudentTone | null;
  amount: number;
  date: string; // booked_on
  note: string | null;
  payerName: string | null;
  payerIban: string | null;
  remittance: string | null;
  source: PaymentSource;
  hiddenReason: string | null; // set = hidden ("ne mokinio mokėjimas")
  knownStudentId: string | null; // bank payments: the student this payer is remembered for (payer_aliases)
};

/** Students a payment can belong to – everyone, archived too (an old debt can still be paid). */
export async function listPaymentStudents() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, grade, math_level, tone, price, status")
    .order("first_name");
  if (error) throw new Error(`Nepavyko įkelti mokinių: ${error.message}`);
  const names = displayNames(data.map((s) => ({ id: s.id, firstName: s.first_name, lastName: s.last_name })));
  return data.map((s) => ({
    id: s.id,
    name: names.get(s.id) ?? s.first_name,
    grade: formatGrade(s.grade, s.math_level),
    tone: s.tone,
    price: Number(s.price),
    archived: s.status === "archyvuotas",
  }));
}

export type PaymentStudent = Awaited<ReturnType<typeof listPaymentStudents>>[number];

/**
 * Payments, newest first. `from` / `to` are inclusive dates (YYYY-MM-DD).
 * kind: "assigned" (belongs to a student), "unassigned" (bank payment waiting for a student),
 * "hidden" (hidden bank payments); default = everything except hidden.
 */
export async function listPayments(
  filter: { from?: string; to?: string; studentId?: string; kind?: "assigned" | "unassigned" | "hidden" } = {},
  supabase?: Supabase
) {
  const client = supabase ?? (await createClient());
  let query = client
    .from("payments")
    .select("id, student_id, amount, booked_on, note, payer_name, payer_iban, remittance, source, hidden_reason, students (first_name, last_name, tone)")
    .order("booked_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (filter.from) query = query.gte("booked_on", filter.from);
  if (filter.to) query = query.lte("booked_on", filter.to);
  if (filter.studentId) query = query.eq("student_id", filter.studentId);
  if (filter.kind === "hidden") query = query.not("hidden_at", "is", null);
  else query = query.is("hidden_at", null);
  if (filter.kind === "assigned") query = query.not("student_id", "is", null);
  if (filter.kind === "unassigned") query = query.is("student_id", null);
  const [{ data, error }, students, aliases] = await Promise.all([
    query,
    client.from("students").select("id, first_name, last_name"),
    client.from("payer_aliases").select("id, student_id, payer_name, payer_iban"),
  ]);
  if (error) throw new Error(`Nepavyko įkelti mokėjimų: ${error.message}`);
  const names = displayNames((students.data ?? []).map((s) => ({ id: s.id, firstName: s.first_name, lastName: s.last_name })));
  return data.map(
    (p): PaymentItem => ({
      id: p.id,
      studentId: p.student_id,
      studentName: p.student_id ? (names.get(p.student_id) ?? p.students?.first_name ?? null) : null,
      studentTone: p.students?.tone ?? null,
      amount: Number(p.amount),
      date: p.booked_on,
      note: p.note,
      payerName: p.payer_name,
      payerIban: p.payer_iban,
      remittance: p.remittance,
      source: p.source,
      hiddenReason: p.hidden_reason,
      knownStudentId: p.source === "manual" ? null : (matchStudent(aliases.data ?? [], p)?.studentId ?? null),
    })
  );
}

/** "Nepriskirti mokėjimai": how many bank payments wait for a student, and their sum (Šiandien, navbar). */
export async function countUnassigned(supabase?: Supabase) {
  const client = supabase ?? (await createClient());
  const { data, error } = await client.from("payments").select("amount").is("student_id", null).is("hidden_at", null);
  if (error) throw new Error(`Nepavyko įkelti mokėjimų: ${error.message}`);
  return { count: data.length, total: data.reduce((sum, p) => sum + Number(p.amount), 0) };
}

/* ---------------- profile ledger ---------------- */

export type LedgerRow = {
  key: string;
  kind: "opening" | "lesson" | "cancelled" | "payment";
  date: string;
  time: string | null; // lessons only
  amount: number; // + payment, − held lesson, 0 cancelled
  balance: number; // running balance after this row
  payment: PaymentItem | null;
  lessonId: string | null;
  note: string | null; // payment note / cancel reason
};

/**
 * Profile "Mokėjimai": opening balance, held lessons, cancelled lessons (free) and payments,
 * oldest → newest with a running balance, returned newest first.
 * The last running balance always equals student_balances.balance (same rules).
 */
export async function getLedger(studentId: string) {
  const supabase = await createClient();
  const [balance, payments, lessons] = await Promise.all([
    getStudentBalance(studentId),
    listPayments({ studentId }, supabase),
    supabase
      .from("lessons_view")
      .select("id, starts_at, price, effective_status, cancel_reason")
      .eq("student_id", studentId)
      .in("effective_status", ["ivyko", "atsaukta"])
      .lte("starts_at", new Date().toISOString())
      .order("starts_at"),
  ]);
  if (lessons.error) throw new Error(`Nepavyko įkelti pamokų: ${lessons.error.message}`);

  // Sort key: date, then lessons by time, payments at the end of their day ("sumokėjo po pamokos").
  type Entry = Omit<LedgerRow, "balance">;
  const entries: Entry[] = [];
  const sortKey = (e: Entry) => (e.kind === "payment" ? `${e.date} 2` : `${e.date} 1 ${e.time}`);
  for (const l of lessons.data) {
    const { date, time } = vilniusParts(l.starts_at!);
    const held = l.effective_status === "ivyko";
    entries.push({
      key: l.id!,
      kind: held ? "lesson" : "cancelled",
      date,
      time,
      amount: held ? -Number(l.price) : 0,
      payment: null,
      lessonId: l.id,
      note: held ? null : l.cancel_reason,
    });
  }
  for (const p of payments) {
    entries.push({ key: p.id, kind: "payment", date: p.date, time: null, amount: p.amount, payment: p, lessonId: null, note: p.note });
  }
  entries.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  let running = balance.opening;
  const rows: LedgerRow[] = [];
  if (balance.opening !== 0) {
    rows.push({ key: "opening", kind: "opening", date: OPENING_BALANCE_DATE, time: null, amount: balance.opening, balance: running, payment: null, lessonId: null, note: null });
  }
  for (const e of entries) {
    running += e.amount;
    rows.push({ ...e, balance: Math.round(running * 100) / 100 });
  }

  // Small summary cards: this month (Vilnius) and all time.
  const today = todayVilnius();
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonth = addDays(`${today.slice(0, 7)}-28`, 4).slice(0, 7) + "-01";
  const inMonth = (d: string) => d >= monthStart && d < nextMonth;
  const monthHeld = rows.filter((r) => r.kind === "lesson" && inMonth(r.date));
  const monthPaid = rows.filter((r) => r.kind === "payment" && inMonth(r.date));

  return {
    balance,
    rows: rows.reverse(),
    month: {
      start: monthStart,
      held: monthHeld.length,
      charged: -monthHeld.reduce((s, r) => s + r.amount, 0),
      cancelled: rows.filter((r) => r.kind === "cancelled" && inMonth(r.date)).length,
      payments: monthPaid.length,
      paid: monthPaid.reduce((s, r) => s + r.amount, 0),
    },
    totalPayments: payments.length,
  };
}

export type Ledger = Awaited<ReturnType<typeof getLedger>>;
