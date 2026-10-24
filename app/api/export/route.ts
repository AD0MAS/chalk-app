import { connection, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth";
import { getJournal, journalYears } from "@/lib/finance/queries";
import { ACTIVITY } from "@/lib/tax/constants";
import { vilniusParts } from "@/lib/lessons/time";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

// Nustatymai → "Eksportuoti duomenis". Runs on the server with Adomas's own session, so RLS
// decides what comes back (the Google token table is never readable this way).
//   ?failas=json       → every table as one JSON file
//   ?failas=mokiniai   → students.csv   (with balance)
//   ?failas=pamokos    → lessons.csv    (Vilnius date/time, effective status)
//   ?failas=mokejimai  → payments.csv
//   ?failas=zurnalas&metai=2026 → apskaitos žurnalas (Finansai → Mokesčiai)
// CSV is made for Excel in Lithuanian: ";" separator, decimal comma, UTF-8 with BOM.

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Table = keyof Database["public"]["Tables"];

const TABLES = [
  "students",
  "student_status_history",
  "schedule_slots",
  "lessons",
  "lesson_notes",
  "gaps",
  "payments",
  "payer_aliases",
  "historical_income",
  "settings",
] as const satisfies readonly Table[];

async function readAll(supabase: Supabase, table: Table | "lessons_view" | "student_balances", order = "created_at") {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    // One generic reader for tables and views; the cast only quiets the typed table-name overloads.
    let query = supabase.from(table as Table).select("*").range(from, from + 999);
    if (order) query = query.order(order);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < 1000) return rows;
  }
}

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? String(value).replace(".", ",") : String(value);
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(header: string[], rows: unknown[][]) {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

function download(body: string, filename: string, type: string) {
  return new Response(body, {
    headers: {
      "Content-Type": `${type}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  await connection();
  const supabase = await createClient();
  // proxy.ts lets only Adomas through; this is a second lock on the door.
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  if (!data?.claims?.sub || !isAllowedEmail(email)) return new Response(null, { status: 401 });

  const kind = request.nextUrl.searchParams.get("failas") ?? "json";
  const now = vilniusParts(new Date());
  const stamp = `${now.date}_${now.time.replace(":", "")}`;

  try {
    if (kind === "json") {
      const tables: Record<string, Record<string, unknown>[]> = {};
      for (const t of TABLES) tables[t] = await readAll(supabase, t, t === "settings" ? "key" : "created_at");
      const counts = Object.fromEntries(Object.entries(tables).map(([t, rows]) => [t, rows.length]));
      const body = JSON.stringify({ exported_at: new Date().toISOString(), counts, tables }, null, 2);
      return download(body, `chalk_${stamp}.json`, "application/json");
    }

    if (kind === "zurnalas") {
      const year = Number(request.nextUrl.searchParams.get("metai"));
      if (!journalYears(now.date).includes(year)) return new Response("Nežinomi metai", { status: 400 });
      const journal = await getJournal(year, supabase);
      const money = (n: number | null) => (n === null ? "" : n.toFixed(2).replace(".", ","));
      const rows: unknown[][] = [
        [`Pajamų ir išlaidų apskaitos žurnalas, ${year} m.`],
        [`Individuali veikla pagal pažymą · veikla: ${ACTIVITY} · pinigų apskaitos principas`],
        [],
        ["Eilės nr.", "Data", "Pajamų suma", "Išlaidos / leidžiami atskaitymai", "Pelnas"],
        ...journal.rows.map((r) => [r.nr, r.date, money(r.income), money(r.deduction), money(r.profit)]),
        ["Iš viso", "", money(journal.totals.income), money(journal.totals.deduction), money(journal.totals.profit)],
      ];
      return download(csv(rows[0] as string[], rows.slice(1)), `chalk_apskaitos_zurnalas_${year}.csv`, "text/csv");
    }

    const students = await readAll(supabase, "students", "first_name");
    const name = new Map(students.map((s) => [s.id as string, [s.first_name, s.last_name].filter(Boolean).join(" ")]));

    if (kind === "mokiniai") {
      const balances = new Map((await readAll(supabase, "student_balances", "")).map((b) => [b.student_id as string, b]));
      const header = ["id", "vardas", "pavardė", "klasė", "lygis", "statusas", "kaina", "pradinis_likutis", "sumokėta", "už_pamokas", "balansas", "mokinio_tel", "mokinio_el_paštas", "tėvų_vardas", "tėvų_tel", "tėvų_el_paštas", "meet", "lenta", "apie_mokinį", "sukurta"];
      const rows = students.map((s) => {
        const b = balances.get(s.id as string);
        return [s.id, s.first_name, s.last_name, s.grade, s.math_level, s.status, Number(s.price), Number(s.opening_balance), Number(b?.paid ?? 0), Number(b?.charged ?? 0), Number(b?.balance ?? 0), s.student_phone, s.student_email, s.parent_name, s.parent_phone, s.parent_email, s.meet_url, s.board_url, s.notes, s.created_at];
      });
      return download(csv(header, rows), `chalk_mokiniai_${stamp}.csv`, "text/csv");
    }

    if (kind === "pamokos") {
      const lessons = await readAll(supabase, "lessons_view", "starts_at");
      const header = ["id", "data", "laikas", "mokinys", "būsena", "kaina", "rūšis", "perkelta_iš", "atšaukimo_priežastis"];
      const rows = lessons.map((l) => {
        const start = vilniusParts(l.starts_at as string);
        const original = l.original_starts_at ? vilniusParts(l.original_starts_at as string) : null;
        return [l.id, start.date, start.time, name.get(l.student_id as string), l.effective_status, Number(l.price), l.kind === "one_off" ? "vienkartinė" : "savaitinė", original ? `${original.date} ${original.time}` : "", l.cancel_reason];
      });
      return download(csv(header, rows), `chalk_pamokos_${stamp}.csv`, "text/csv");
    }

    if (kind === "mokejimai") {
      const payments = await readAll(supabase, "payments", "booked_on");
      const header = ["id", "data", "mokinys", "suma", "šaltinis", "pastaba", "mokėtojas", "mokėtojo_iban", "paskirtis"];
      const rows = payments.map((p) => [p.id, p.booked_on, p.student_id ? name.get(p.student_id as string) : "nepriskirtas", Number(p.amount), p.source, p.note, p.payer_name, p.payer_iban, p.remittance]);
      return download(csv(header, rows), `chalk_mokejimai_${stamp}.csv`, "text/csv");
    }

    return new Response("Nežinomas failas", { status: 400 });
  } catch (error) {
    console.error("export:", error instanceof Error ? error.message : error);
    return new Response("Nepavyko eksportuoti. Pabandyk dar kartą.", { status: 500 });
  }
}
