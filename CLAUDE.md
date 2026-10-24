# Chalk — instructions for Claude Code

Chalk is Adomas's private web app for running his math tutoring practice. Full context lives in these files — read them before any task:

@docs/SPEC.md
@docs/DESIGN.md

## Working rules
- **Talk to Adomas in Lithuanian.** Code, comments, commits, identifiers in English. All UI strings in Lithuanian.
- **Design:** follow `docs/DESIGN.md` exactly. The floating glass pill navbar (§1) is the signature element — there is no sidebar. Rounded corners everywhere, content centred.
- **Dashes:** always en dash – (never em dash —) in UI, exports, docs and commit messages.
- **Keep it simple** — student-appropriate, readable code; no over-engineering, no premature abstractions.
- **Data safety is non-negotiable** (SPEC §6): backup to `private/` + explicit confirmation before any destructive/bulk operation, migration, re-import or Google Calendar change. Never touch Google events Chalk didn't create without confirmation.
- **Always run `npm run backup` before every migration (`npm run db:push`) or bulk data change** (import, re-import, mass edit/delete, restore). Supabase Free has no automatic backups. Mention the backup file name to Adomas. Restore only via `npm run restore -- <file>` (asks to type ATKURTI).
- `private/` is git-ignored and contains personal data (minors' details, backups). Never commit it, never print its contents in full, never send it anywhere.
- Secrets only in `.env.local` / Supabase secrets; keep `.env.example` updated with names only.
- Timezone: store `timestamptz`, compute weekly slots in `Europe/Vilnius` (DST!).
- Work in small steps; run `lint`, `typecheck` and the app before saying something is done. Show Adomas how to check it.
- Ask before adding a new dependency or service.

## Commands
- dev: `npm run dev` (http://localhost:3000)
- lint / typecheck: `npm run lint`, `npm run typecheck` (runs `next typegen` first)
- build: `npm run build`
- Supabase migrations: `supabase/migrations/*.sql` → `npm run backup` then `npm run db:push`, then `npm run db:types`
- backup / restore: `npm run backup` → `private/backups/YYYY-MM-DD_HHmm.json`; `npm run restore -- <file>`
- Next.js 16 differs from older versions — check `node_modules/next/dist/docs/` (see AGENTS.md) before using an API you're unsure of.
