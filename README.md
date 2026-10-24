# Chalk

Chalk is a single-user web app for running a private math tutoring practice: students, weekly schedules, lessons, lesson notes, payments, balances and self-employment taxes in one place. It replaced a Google Doc, a hand-kept Google Calendar and checking the banking app by hand.

It is in **daily production use** by one tutor (me). The UI is in **Lithuanian**; code, comments and docs are in English. This repository is a sanitized public copy – it contains no student data, credentials or backups.

## Features

- **Students** – grade and math level, status (arranging / regular / ad hoc / paused / archived) with history, price per lesson, permanent Meet and whiteboard links, contacts, knowledge gaps, general notes.
- **Weekly slots and lessons** – regular lessons are generated from weekly slots up to the end of next month (idempotent, DST-aware in `Europe/Vilnius`). Reschedule one lesson or the series "from now on", cancel (never charged); past lessons automatically count as held.
- **Lesson notes** – four short fields per lesson; "start next time from…" is shown prominently before the next lesson, and held lessons without notes are listed until written.
- **Today** – day strip, focus card for the current or next lesson with one-click join, upcoming and finished lessons, stat cards.
- **Schedule** – week view with drag-to-reschedule (desktop and touch), conflict warnings against other lessons.
- **Money as a ledger** – balance = opening balance + payments − held lessons; debts and prepaid lessons per student, running balance per student.
- **Bank import** – incoming payments from the tutor's own bank account via Enable Banking (PSD2, restricted mode), with a CSV statement upload as fallback; payers are matched to students by IBAN or full name and remembered.
- **Finances and taxes** – earned / received / debts / prepaid per week, month or year, a month-end forecast, monthly chart, and an estimate of Lithuanian self-employment taxes (GPM, VSD, PSD) with the legally required income journal (CSV / print export).
- **Google Calendar** – every lesson is mirrored one-way into a dedicated calendar that Chalk creates.
- **Data export** – JSON / CSV backup of everything; backup and restore scripts.
- **PWA** – installable on the phone; fully responsive with no horizontal scrolling.

## Tech stack

- **Next.js 16** (App Router, Server Components, Server Actions) + **TypeScript**
- **Tailwind CSS v4**, **shadcn/ui** (Radix), **Motion** for the morphing navbar, **lucide-react**, Inter + Source Serif 4
- **Supabase** – Postgres, Auth (email + password, a single allowed email), Row Level Security, SQL migrations
- **Vercel** (Hobby) – hosting and a daily cron job
- **Google Calendar API**, **Enable Banking API**

## Architecture

- **Supabase RLS + SQL functions.** Every table has Row Level Security scoped to the owner. Business rules that must have a single source of truth live in the database: `generate_lessons()` (rolling lesson generation from weekly slots), `prune_planned_lessons()` (safe cleanup of future, untouched lessons), the `lessons_view.effective_status` column (a past, non-cancelled lesson counts as held) and the `student_balances` view. Migrations are in `supabase/migrations/`.
- **Google Calendar sync.** Chalk is the source of truth. It uses only the `calendar.app.created` scope and writes to its own calendar; each event id is derived from the lesson id. Database triggers mark changed lessons as dirty, and the sync runs right after each action (`after()`), from the navbar every minute while the app is open, and from a daily cron as a safety net. Events Chalk did not create are never touched.
- **Enable Banking import.** Server-side JWT signed with the application's private key; only incoming EUR payments are imported, deduplicated by bank transaction id. A request budget in the database keeps unattended calls within the PSD2 limit of 4 per 24 h; attended syncs forward the user's PSU headers. Consent expiry is shown with a renewal button.
- **Vercel cron.** `/api/cron/sync` (protected by `CRON_SECRET`) runs daily and catches up both syncs.
- **Auth.** `proxy.ts` (Next.js 16's middleware) lets only the single allowed email through; server routes check again. Service-role keys are used only on the server.
- **Design.** A calm, Craft-inspired design system with a floating glass navbar that morphs into a menu panel – see `docs/DESIGN.md`. The product spec is in `docs/SPEC.md`.

## Built with AI assistance

Built with AI assistance (Claude Code); spec, architecture, design and testing by me.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in the values (Supabase project URL and keys, the allowed email, and optionally Google OAuth and Enable Banking credentials). The file documents every variable.
3. Apply the database migrations to your Supabase project and regenerate types:
   ```bash
   npm run db:push
   npm run db:types
   ```
4. Set the login password and start the dev server (http://localhost:3000):
   ```bash
   npm run auth:set-password
   npm run dev
   ```

Other commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run backup`, `npm run restore -- <file>`.

## Screenshots

_Coming soon – screenshots will live in `docs/screenshots/`._
