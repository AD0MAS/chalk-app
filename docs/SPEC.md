# Chalk — Product Spec

Private web app for **Adomas**, a self-employed online math tutor in Lithuania (grades 5–12, about a dozen students, one-hour Google Meet lessons several times a day). It replaces a Google Doc + manually kept Google Calendar + bank-app checking. **Single user.** UI language **Lithuanian**, currency **EUR**, timezone **Europe/Vilnius** (DST-aware!).

## 1. Domain

### Student (`students`)
- Name, grade (5–12), **math level A/B for grades 11–12 only** — default **A** when unknown; always display as e.g. "12 kl B", "11 kl A", "7 kl".
- Status: **Derinama** (contacted / maybe a first lesson booked, weekly times not agreed) · **Pastovus** (fixed weekly slots, 1×/2×/more) · **Nepastovus** (lessons booked ad hoc, e.g. before tests) · **Pauzė** · **Archyvuotas**.
- Price per lesson (EUR, per student), **permanent Google Meet link**, **permanent tldraw board link**, accent colour.
- Contacts: student (phone, email) and parent (name, phone, email); either may be empty.
- Free-text general notes ("Apie mokinį").
- Status and weekly-slot changes keep history (e.g. 1×→2× from a date; Nepastovus → Pastovus and back).
- Actions: add, edit, archive (keeps everything), delete (permanent, typed confirmation).

### Weekly slots (`schedule_slots`)
- student, weekday, local start time (HH:MM), `valid_from`, `valid_to` (nullable). All lessons are **60 min**.

### Lesson (`lessons`)
- student, `starts_at` (timestamptz), duration 60, `price` snapshot at creation, `kind` (regular | one-off), `slot_id` (nullable), `status`: Suplanuota · Įvyko · Atšaukta.
- Rolling generation of regular lessons from active slots **until the end of next month** (so the current month is always complete; idempotent).
- A past lesson that wasn't cancelled is automatically **Įvyko** after its end time — Adomas only marks cancellations.
- **Reschedule (very frequent):** "Tik šią pamoką" (moves one lesson; it becomes an exception, original time kept in `original_starts_at`) or "Nuo dabar visam laikui" (closes the old slot, opens a new one from a date, regenerates future lessons). Picker shows conflicts with Google Calendar busy events (other commitments).
- **Cancel:** UI first suggests rescheduling; if cancelled → status Atšaukta, **never charged**.
- One-off lessons for Nepastovus/Derinama students added manually.

### Lesson notes (`lesson_notes`, 1:1 with lesson)
Four fields: **Ką darėm · Kur baigėm · ND · Kitą kartą pradėti nuo**. Each note belongs to a dated lesson. The "pradėti nuo" of the latest note is shown prominently before the next lesson. Past held lessons without notes appear in "Laukia užrašų". **Historical notes from the old Google Doc are NOT imported.**

### Gaps (`gaps`)
Per student: text, created date, resolved flag/date. Imported from the old doc verbatim.

### Money — ledger, not "paid/unpaid"
Students pay every way: per lesson, weekly, monthly, prepaid packages. So:
- **balance = Σ payments − Σ price of lessons with status Įvyko**. Negative = debt (red), positive = prepaid (show "≈ N pamokos į priekį").
- No payment splitting between students (not needed).
- No debt reminders, no invoices (not needed).

### Payments (`payments`, `payer_aliases`)
- Fields: amount, booked date, payer name, payer IBAN, remittance text, bank transaction id (unique), source (bank | manual | csv), student_id (nullable = unassigned).
- **Phase 1:** manual entry. **Phase 3:** automatic import from **the tutor's own bank account**, via **Enable Banking** API in free *restricted* mode (own linked accounts only). Sync on app open + every few hours (Supabase cron; Vercel Hobby cron is only daily). Consent must be renewed periodically — show expiry + "Pratęsti". Fallback if the bank's production API doesn't work: CSV statement upload.
- Matching: first payment from an unknown payer → manual assign with "Prisiminti šį mokėtoją" → `payer_aliases` (name/IBAN → student); later payments auto-assigned.

### Taxes (Phase 4)
Adomas works under **individuali veikla pagal pažymą (IV)**, cash accounting (pinigų apskaita) → the tax base is **payments received** in the calendar year (only payments assigned to students), not lessons held. All rates/thresholds live in a settings table (editable), prefilled with 2026 values and labelled "pasitikrink VMI / Sodra". Estimate only, not tax advice.
- Deduction: **30 % of income** (default; option "faktinės išlaidos" with a manual yearly amount). Taxable income = income − deduction.
- **GPM 2026** (VMI): 20 % of taxable income minus a credit: taxable ≤ 20 000 € → credit = taxable × 0.15 (effective 5 %); 20 000–42 500 € → credit = taxable × (0.15 − 2/300 000 × (taxable − 20 000)); > 42 500 € → no credit (general progressive rates — just show a warning).
- **VSD** 12.52 % and **PSD** 6.98 % of 90 % of taxable income.
- **Monthly minimum PSD** is a settings toggle (off when PSD is paid by the state, e.g. for full-time students). First-year reliefs are not modelled.
- **Historical income** (type "istorinės pajamos": date, amount, payer, note; no student, never affects balances, counts for taxes and the journal): imported once from a private income spreadsheet + tutoring payments from a bank statement for the weeks before bank sync started, each row confirmed manually (the account also receives non-tutoring money). From the bank-sync start date on, the tax base = bank/manual payments assigned to students; non-tutoring bank payments are hidden ("ne mokinio mokėjimas").
- Finansai tax card: year-to-date income (historical + student payments), GPM / VSD / PSD estimate, "Atidėk ≈ X €" (total and per month), deadline: GPM311 by May 1 next year.
- **Apskaitos žurnalas** (legally required IV income/expense journal): yearly view + CSV/print export with columns Eilės nr. · Data · Pajamų suma · Išlaidos / leidžiami atskaitymai · Pelnas, one row per received payment incl. historical rows (activity: "Kitas, niekur nepriskirtas, švietimas").

### Quick links (settings)
Eduka (https://eduka.lt/, same for everyone), tldraw (new board), ChatGPT, Claude, Google Calendar.

## 2. Google Calendar
- Chalk is the **source of truth** for lessons. It writes to a **dedicated calendar "Pamokos"** in Adomas's Google account (create it on connect). One-way sync app → Google (create/update/delete on every lesson change). Event title format: `Vardas 12 kl B`; description includes Meet link.
- **Chalk shows only students and lessons — never other Google Calendar events** (no lectures, training etc. anywhere in the app). Conflict warnings compare against other Chalk lessons only.
- **Migration (Phase 2), data-safety critical:** existing lessons are recurring events in the primary calendar (green, colorId 10, titles like "Vardas 11 kl"). Procedure: (1) fresh JSON+PDF backup of all events ≥ 1 month ahead into `private/`; (2) generate lessons in Chalk + "Pamokos" calendar; (3) show Adomas a side-by-side diff old vs new for 4 weeks; (4) **only after his explicit confirmation** end/delete the old series. Never delete or modify any Google event that Chalk did not create without explicit confirmation.

## 3. Screens (all under the floating glass navbar — see DESIGN.md §1)
1. **Šiandien** (home), top to bottom, centred:
   - greeting + date line;
   - **day strip** 08–22 with a "dabar" line — **only today's Chalk lessons** (student blocks in their tone), nothing else;
   - **focus card** for the current/next lesson: name, grade+level, time, progress/countdown, **"Pradėti nuo: …" (most prominent text)**, gaps chips, **Prisijungti** / **Lenta** / **Užrašai**; right side "Praėjusi pamoka" (Ką darėm · Kur baigėm · ND) + link to all notes;
   - **"Toliau šiandien"**: remaining lessons, **one full-width row per lesson, stacked vertically** (not a grid), each with pradėti nuo, gaps, Prisijungti / Lenta;
   - "Jau įvyko" compact rows (with "Rašyti užrašus" if notes missing);
   - four stat cards: Laukia užrašų · Nepriskirti mokėjimai · Skolos · Ši savaitė.
2. **Pamoka** (lesson panel/sheet) — left: last 3 notes + open gaps; right: the 4-field notes form (autosave). Actions: Perkelti, Atšaukti.
3. **Perkelti pamoką** modal — "Tik šią pamoką" / "Nuo dabar visam laikui", date+time picker showing that day's other Chalk lessons & a conflict warning (move still allowed), note that Google Calendar updates.
4. **Mokiniai** — status tabs with counts, search, list in a rounded card: name, grade+level, status pill, weekly schedule ("Antr 18:00 · Ketv 18:00"), price, balance.
5. **Mokinio profilis** — header (name, grade+level, status, balance, Meet / Lenta / Redaguoti). Tabs: Apžvalga (contacts, current slots + change history, gaps, general notes), Užrašai (lesson timeline, newest first), Mokėjimai (ledger with running balance).
6. **Naujas / redaguoti mokinį** — form; status + weekly-slot editor (weekday + time rows) with "galioja nuo".
7. **Tvarkaraštis** — week view of Chalk lessons only (student tones); drag to reschedule (opens modal #3).
8. **Finansai** — period switch (savaitė / mėnuo / metai): Uždirbta (held lessons; for the current month also "Prognozė ≈ X €" = earned so far + remaining planned non-cancelled lessons until month end), Gauta (payments), Skolos, Avansai; monthly bar chart – one bar per month: Gauta (received payments + historical income, same base as taxes), no legend; per-student table; tax card.
9. **Mokėjimai** — transactions, filter matched/unassigned, assign dialog.
10. **Nustatymai** — Google Calendar connection, bank (Enable Banking) connection (consent expiry), quick links, tax rates, data export (JSON/CSV backup of everything).

Empty, loading (skeleton) and error states everywhere; toasts for confirmations. Desktop-first (laptop), fully responsive.

## 4. Tech stack
- **Next.js (App Router) + TypeScript**, **Tailwind CSS v4**, **shadcn/ui**, **Motion** (framer-motion) for the navbar morph, **lucide-react** icons, `next/font` (Inter, Source Serif 4).
- **Supabase**: Postgres + Auth (magic link / Google, **only Adomas's email allowed**), Row Level Security on every table, SQL migrations in repo, Edge Functions + `pg_cron` for bank sync & lesson generation.
- **Vercel** (Hobby), subdomain like `chalk-…vercel.app` (decide at deploy).
- Integrations: Google Calendar API (OAuth, refresh token stored server-side), Enable Banking API (JWT signed with app private key, server-side only).
- Secrets only in env vars / Supabase secrets — never in client code or git.
- Keep it student-appropriate: simple, readable, no over-engineering.

## 5. Phases
0. **Design** — `/design` artboards for all screens using DESIGN.md; Adomas picks; then implement.
1. **MVP** — auth, navbar, students (CRUD, statuses, levels, slots, history), lessons (generation, reschedule, cancel, auto-Įvyko), notes, gaps, Šiandien, Mokiniai, profile, manual payments, balances, data import from `private/students_import.json`, data export.
2. **Google Calendar** — connect, "Pamokos" calendar, one-way sync, safe migration (§2).
3. **Bank via Enable Banking** — link, sync, payer matching, CSV fallback.
4. **Finansai + taxes**.
Later: parents' read-only page (secret link), AI helpers.

## 6. Data safety rules (non-negotiable)
- Adomas's data is very important. Before any destructive or bulk operation (deletes, migrations, re-imports, Google Calendar changes) make a backup into `private/` and get explicit confirmation.
- Soft-delete/archive by default; permanent delete only via explicit UI confirmation.
- `private/` is git-ignored (contains minors' contact data, Meet links, backups). The production repo is **private**; this public copy contains no personal data.
