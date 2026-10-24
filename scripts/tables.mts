import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types.ts";

// Every Chalk table, in an order where parents come before children (safe insert order).
// Restore deletes in the reverse order.
export const TABLES = [
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
] as const satisfies readonly (keyof Database["public"]["Tables"])[];

export type TableName = (typeof TABLES)[number];

export type BackupFile = {
  created_at: string;
  project_url: string;
  counts: Record<TableName, number>;
  tables: Record<TableName, Record<string, unknown>[]>;
};

/** Server-only client with the secret key (service_role). Never use this in the app. */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Trūksta NEXT_PUBLIC_SUPABASE_URL arba SUPABASE_SECRET_KEY faile .env.local.");
    process.exit(1);
  }
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Reads a whole table, 1000 rows at a time. */
export async function readTable(supabase: ReturnType<typeof adminClient>, table: TableName) {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data as Record<string, unknown>[]));
    if (data.length < pageSize) return rows;
  }
}

/** Dumps every table to private/backups/YYYY-MM-DD_HHmm.json (Vilnius time). Returns the path. */
export async function writeBackup(supabase: ReturnType<typeof adminClient>): Promise<string> {
  const { mkdir, writeFile } = await import("node:fs/promises");

  const tables = {} as BackupFile["tables"];
  const counts = {} as BackupFile["counts"];
  for (const table of TABLES) {
    tables[table] = await readTable(supabase, table);
    counts[table] = tables[table].length;
  }

  const stamp = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Vilnius",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .format(new Date())
    .replace(" ", "_")
    .replaceAll(":", "");
  // YYYY-MM-DD_HHmm (+ seconds only if that minute already has a backup)
  await mkdir("private/backups", { recursive: true });
  let path = `private/backups/${stamp.slice(0, 15)}.json`;
  const { existsSync } = await import("node:fs");
  if (existsSync(path)) path = `private/backups/${stamp}.json`;

  const file: BackupFile = {
    created_at: new Date().toISOString(),
    project_url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    counts,
    tables,
  };
  await writeFile(path, JSON.stringify(file, null, 2), "utf8");
  return path;
}
