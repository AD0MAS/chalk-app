import { ensureLessons } from "@/lib/lessons/queries";
import { todayVilnius, vilniusParts, vilniusToIso } from "@/lib/lessons/time";
import { displayNames } from "@/lib/names";
import { getBalances } from "@/lib/payments/queries";
import { formatGrade, type StudentTone } from "@/lib/students/constants";
import { createClient } from "@/lib/supabase/server";
import { estimateTax } from "@/lib/tax/calc";
import { readTaxSettings, type TaxSettings } from "@/lib/tax/constants";
import { MONTHS_NOMINATIVE, MONTHS_SHORT, type Period } from "./period";

// Finansai (SPEC §3.8) and taxes (SPEC §1 Taxes). Read-only, request time – callers sit inside <Suspense>.
//   Uždirbta = price of held lessons (lessons_view.effective_status – the one place Įvyko is decided)
//   Gauta    = payments assigned to students + historical income (hidden "ne mokinio" payments never count)
//   Skolos / Avansai = today's balances (student_balances – the same numbers as everywhere else)
//   Tax base = Gauta of the calendar year (cash accounting)

type Supabase = Awaited<ReturnType<typeof createClient>>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Reads every page of a query (Supabase returns at most 1000 rows per request). */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(`Nepavyko įkelti finansų: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return rows;
  }
}

/** Held lessons with a start in [from, to) (Vilnius dates). */
async function heldLessons(from: string, to: string, supabase: Supabase) {
  const rows = await readAll((a, b) =>
    supabase
      .from("lessons_view")
      .select("id, student_id, price, starts_at")
      .eq("effective_status", "ivyko")
      .gte("starts_at", vilniusToIso(from, "00:00"))
      .lt("starts_at", vilniusToIso(to, "00:00"))
      .order("starts_at")
      .range(a, b)
  );
  return rows.map((l) => ({ studentId: l.student_id!, price: Number(l.price), date: vilniusParts(l.starts_at!).date }));
}

/** Uždirbta in [from, to): Šiandien "Ši savaitė" and Finansai use this same function. */
export async function earnedBetween(from: string, to: string, supabase?: Supabase) {
  const lessons = await heldLessons(from, to, supabase ?? (await createClient()));
  return { total: round2(lessons.reduce((s, l) => s + l.price, 0)), count: lessons.length };
}

/**
 * "Prognozė" for the current month [from, to): Uždirbta so far + the price of every lesson still planned until the
 * month ends (effective status Suplanuota – not cancelled, not yet over; one-offs and moved lessons included).
 * Lessons are generated first; generate_lessons() reaches the end of next month, so the current month is always complete.
 */
export async function monthForecast(from: string, to: string, supabase?: Supabase) {
  const client = supabase ?? (await createClient());
  await ensureLessons(client);
  const [earned, planned] = await Promise.all([
    earnedBetween(from, to, client),
    readAll((a, b) =>
      client
        .from("lessons_view")
        .select("id, price")
        .eq("effective_status", "suplanuota")
        .gte("starts_at", vilniusToIso(from, "00:00"))
        .lt("starts_at", vilniusToIso(to, "00:00"))
        .order("starts_at")
        .range(a, b)
    ),
  ]);
  const plannedTotal = round2(planned.reduce((s, l) => s + Number(l.price), 0));
  return { earned: earned.total, planned: { total: plannedTotal, count: planned.length }, total: round2(earned.total + plannedTotal) };
}

/** Money received in [from, to): student payments (assigned or not, never hidden) and historical income. */
async function received(from: string, to: string, supabase: Supabase) {
  const [payments, historical] = await Promise.all([
    readAll((a, b) =>
      supabase
        .from("payments")
        .select("id, student_id, amount, booked_on, created_at")
        .is("hidden_at", null)
        .gte("booked_on", from)
        .lt("booked_on", to)
        .order("booked_on")
        .order("created_at")
        .range(a, b)
    ),
    readAll((a, b) =>
      supabase
        .from("historical_income")
        .select("id, amount, received_on, created_at")
        .gte("received_on", from)
        .lt("received_on", to)
        .order("received_on")
        .order("created_at")
        .range(a, b)
    ),
  ]);
  return {
    payments: payments.map((p) => ({ id: p.id, studentId: p.student_id, amount: Number(p.amount), date: p.booked_on, createdAt: p.created_at })),
    historical: historical.map((h) => ({ id: h.id, amount: Number(h.amount), date: h.received_on, createdAt: h.created_at })),
  };
}

export async function getTaxSettings(supabase?: Supabase): Promise<TaxSettings> {
  const client = supabase ?? (await createClient());
  const { data, error } = await client.from("settings").select("value").eq("key", "tax").maybeSingle();
  if (error) throw new Error(`Nepavyko įkelti mokesčių nustatymų: ${error.message}`);
  return readTaxSettings(data?.value);
}

/** The tax card: income received in `year` (historical + assigned payments) and the estimate. */
function taxFor(year: number, income: { historical: number; students: number }, settings: TaxSettings, today: string) {
  const thisYear = Number(today.slice(0, 4));
  // Months so far: the whole year when it is over, otherwise up to and including this month.
  const months = year < thisYear ? 12 : Math.max(1, Number(today.slice(5, 7)));
  const estimate = estimateTax(income.historical + income.students, settings, months);
  return {
    year,
    months,
    current: year === thisYear,
    historical: round2(income.historical),
    students: round2(income.students),
    estimate,
    perMonth: round2(estimate.total / months),
    settings,
  };
}

export type TaxCardData = ReturnType<typeof taxFor>;

export type FinanceStudentRow = {
  id: string;
  name: string;
  grade: string;
  tone: StudentTone;
  held: number;
  earned: number;
  received: number;
  balance: number;
};

export async function getFinance(period: Period) {
  const supabase = await createClient();
  const today = todayVilnius();
  const year = Number(period.from.slice(0, 4));
  // One read covers the period and its whole year (the chart and the tax card are yearly).
  const rangeFrom = `${year}-01-01`;
  const rangeTo = period.to > `${year + 1}-01-01` ? period.to : `${year + 1}-01-01`;

  const currentMonth = period.kind === "menuo" && period.from === `${today.slice(0, 7)}-01`;

  const [lessons, money, balances, students, settings, forecast] = await Promise.all([
    heldLessons(rangeFrom, rangeTo, supabase),
    received(rangeFrom, rangeTo, supabase),
    getBalances(supabase),
    supabase.from("students").select("id, first_name, last_name, grade, math_level, tone, price, status"),
    getTaxSettings(supabase),
    currentMonth ? monthForecast(period.from, period.to, supabase) : null,
  ]);
  if (students.error) throw new Error(`Nepavyko įkelti mokinių: ${students.error.message}`);

  const inPeriod = (d: string) => d >= period.from && d < period.to;
  const inYear = (d: string) => d.startsWith(`${year}-`);
  const sum = (list: { amount?: number; price?: number }[]) => round2(list.reduce((s, x) => s + (x.amount ?? x.price ?? 0), 0));

  const periodLessons = lessons.filter((l) => inPeriod(l.date));
  const periodPayments = money.payments.filter((p) => inPeriod(p.date));
  const assigned = periodPayments.filter((p) => p.studentId);
  const periodHistorical = money.historical.filter((h) => inPeriod(h.date));

  // Names as everywhere else (first name, surname initial when two share it).
  const names = displayNames(students.data.map((s) => ({ id: s.id, firstName: s.first_name, lastName: s.last_name })));
  const studentInfo = new Map(students.data.map((s) => [s.id, s]));

  const debtors = [...balances.entries()].filter(([, b]) => b.balance < 0).sort((a, b) => a[1].balance - b[1].balance);
  const prepaid = [...balances.entries()].filter(([, b]) => b.balance > 0).sort((a, b) => b[1].balance - a[1].balance);
  const nameOf = (id: string) => names.get(id) ?? studentInfo.get(id)?.first_name ?? "–";

  /* ---- monthly chart for the year ---- */
  const months = MONTHS_SHORT.map((short, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    const future = `${month}-01` > today;
    const gotIn = [...money.payments.filter((p) => p.studentId && p.date.startsWith(month)), ...money.historical.filter((h) => h.date.startsWith(month))];
    return {
      short,
      name: MONTHS_NOMINATIVE[i],
      current: month === today.slice(0, 7),
      received: future ? null : sum(gotIn),
    };
  });

  /* ---- per student, for the period ---- */
  const rows: FinanceStudentRow[] = students.data
    .map((s) => {
      const held = periodLessons.filter((l) => l.studentId === s.id);
      return {
        id: s.id,
        name: nameOf(s.id),
        grade: formatGrade(s.grade, s.math_level),
        tone: s.tone,
        held: held.length,
        earned: sum(held),
        received: sum(assigned.filter((p) => p.studentId === s.id)),
        balance: balances.get(s.id)?.balance ?? 0,
        archived: s.status === "archyvuotas",
      };
    })
    // Everyone with money in the period, plus anyone who still owes or has paid ahead.
    .filter((r) => r.held > 0 || r.received !== 0 || (r.balance !== 0 && !r.archived))
    .map(({ archived, ...r }) => (void archived, r));

  const yearHistorical = sum(money.historical.filter((h) => inYear(h.date)));
  const yearStudents = sum(money.payments.filter((p) => p.studentId && inYear(p.date)));

  return {
    today,
    year,
    cards: {
      earned: { total: sum(periodLessons), count: periodLessons.length, forecast },
      received: {
        total: round2(sum(assigned) + sum(periodHistorical)),
        count: assigned.length + periodHistorical.length,
      },
      debts: { total: round2(-debtors.reduce((s, [, b]) => s + b.balance, 0)), names: debtors.map(([id, b]) => ({ name: nameOf(id), amount: -b.balance })) },
      prepaid: { total: round2(prepaid.reduce((s, [, b]) => s + b.balance, 0)), names: prepaid.map(([id, b]) => ({ name: nameOf(id), amount: b.balance })) },
    },
    months,
    rows,
    tax: taxFor(year, { historical: yearHistorical, students: yearStudents }, settings, today),
  };
}

export type FinanceData = Awaited<ReturnType<typeof getFinance>>;

/* ---------------- Mokesčiai: tax card + apskaitos žurnalas ---------------- */

export type JournalRow = { nr: number; date: string; income: number; deduction: number | null; profit: number; historical: boolean };

/**
 * Apskaitos žurnalas for a year: one row per received payment (historical income + payments assigned to students),
 * oldest first. Deduction per row = 30 % norm; with "faktinės išlaidos" rows have none and the yearly amount is
 * shown in the totals.
 */
export async function getJournal(year: number, supabase?: Supabase) {
  const client = supabase ?? (await createClient());
  const today = todayVilnius();
  const [money, settings] = await Promise.all([received(`${year}-01-01`, `${year + 1}-01-01`, client), getTaxSettings(client)]);

  const entries = [
    ...money.historical.map((h) => ({ date: h.date, createdAt: h.createdAt, amount: h.amount, historical: true })),
    ...money.payments.filter((p) => p.studentId).map((p) => ({ date: p.date, createdAt: p.createdAt, amount: p.amount, historical: false })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  const norm = settings.deduction === "norm";
  const rows: JournalRow[] = entries.map((e, i) => {
    const deduction = norm ? round2(e.amount * settings.norm_rate) : null;
    return { nr: i + 1, date: e.date, income: e.amount, deduction, profit: round2(e.amount - (deduction ?? 0)), historical: e.historical };
  });

  const income = round2(rows.reduce((s, r) => s + r.income, 0));
  const deduction = norm ? round2(rows.reduce((s, r) => s + (r.deduction ?? 0), 0)) : Math.min(income, round2(settings.actual_expenses));
  const historical = round2(rows.filter((r) => r.historical).reduce((s, r) => s + r.income, 0));

  return {
    year,
    rows,
    totals: { income, deduction, profit: round2(income - deduction) },
    tax: taxFor(year, { historical, students: round2(income - historical) }, settings, today),
  };
}

export type JournalData = Awaited<ReturnType<typeof getJournal>>;

/** Years the journal can show: 2025 (historical income) up to this year. */
export function journalYears(today: string) {
  const years: number[] = [];
  for (let y = Number(today.slice(0, 4)); y >= 2025; y--) years.push(y);
  return years;
}
