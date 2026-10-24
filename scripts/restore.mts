// npm run restore -- private/backups/2026-10-20_2215.json
//
// Replaces ALL Chalk data with the contents of a backup file.
// Safety: shows what will change, makes a fresh backup of the current data first,
// and only continues after you type ATKURTI.
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { adminClient, readTable, TABLES, writeBackup, type BackupFile } from "./tables.mts";

const path = process.argv[2];
if (!path) {
  console.error("Nurodyk failą: npm run restore -- private/backups/<failas>.json");
  process.exit(1);
}

const backup = JSON.parse(await readFile(path, "utf8")) as BackupFile;
const supabase = adminClient();

if (backup.project_url && backup.project_url !== process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error(`Kopija padaryta kitam projektui (${backup.project_url}). Stabdau.`);
  process.exit(1);
}

console.log(`Kopija: ${path} (sukurta ${backup.created_at})\n`);
console.log("  lentelė                   dabar → po atkūrimo");
for (const table of TABLES) {
  const now = (await readTable(supabase, table)).length;
  console.log(`  ${table.padEnd(24)} ${String(now).padStart(5)} → ${backup.tables[table]?.length ?? 0}`);
}

const rl = createInterface({ input: stdin, output: stdout });
const answer = await rl.question("\nVisi dabartiniai duomenys bus pakeisti. Įrašyk ATKURTI, kad tęstum: ");
rl.close();
if (answer.trim() !== "ATKURTI") {
  console.log("Atšaukta – niekas nepakeista.");
  process.exit(0);
}

const safety = await writeBackup(supabase);
console.log(`Dabartinių duomenų kopija: ${safety}`);

// Delete children first, then insert parents first.
for (const table of [...TABLES].reverse()) {
  const { error } = await supabase.from(table).delete().not("owner_id", "is", null);
  if (error) throw new Error(`Trinant ${table}: ${error.message}`);
}
for (const table of TABLES) {
  const rows = backup.tables[table] ?? [];
  for (let i = 0; i < rows.length; i += 500) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from(table).insert(rows.slice(i, i + 500) as any);
    if (error) throw new Error(`Įrašant ${table}: ${error.message}. Dabartiniai duomenys išsaugoti: ${safety}`);
  }
  console.log(`  ${table.padEnd(24)} ${rows.length} atkurta`);
}
console.log("Atkūrimas baigtas.");
