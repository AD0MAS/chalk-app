// npm run backup – dumps every Chalk table to private/backups/YYYY-MM-DD_HHmm.json.
// Run before every migration, import or other bulk data change (CLAUDE.md).
import { adminClient, writeBackup } from "./tables.mts";

const supabase = adminClient();
const path = await writeBackup(supabase);

const { readFile } = await import("node:fs/promises");
const { counts } = JSON.parse(await readFile(path, "utf8"));
console.log(`Atsarginė kopija išsaugota: ${path}`);
for (const [table, count] of Object.entries(counts)) console.log(`  ${table.padEnd(24)} ${count}`);
