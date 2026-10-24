-- Chalk — initial schema (docs/SPEC.md §1).
--
-- Rules used everywhere:
--   * every row belongs to a user: owner_id defaults to auth.uid()
--   * Row Level Security on every table: a user only sees and changes their own rows
--   * tables are NOT exposed automatically (project setting), so access is granted explicitly
--     to the `authenticated` role only — nothing to `anon`
--   * times are timestamptz; weekly slot times are local Europe/Vilnius wall-clock times

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.student_status as enum ('derinama', 'pastovus', 'nepastovus', 'pauze', 'archyvuotas');
create type public.math_level as enum ('A', 'B');
create type public.student_tone as enum (
  'sky', 'sage', 'clay', 'lavender', 'sand', 'rose', 'mist', 'apricot', 'plum', 'slate', 'moss', 'coral'
);
create type public.lesson_kind as enum ('regular', 'one_off');
create type public.lesson_status as enum ('suplanuota', 'ivyko', 'atsaukta');
create type public.payment_source as enum ('bank', 'manual', 'csv');

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------

create table public.students (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  first_name    text not null check (length(trim(first_name)) between 1 and 80),
  last_name     text check (length(last_name) <= 80),
  grade         smallint not null check (grade between 5 and 12),
  -- A/B only for grades 11–12 (the app fills in 'A' when unknown); always empty for 5–10.
  math_level    public.math_level,
  status        public.student_status not null default 'derinama',
  price         numeric(8, 2) not null check (price >= 0),
  tone          public.student_tone not null default 'sky',
  meet_url      text,
  board_url     text,
  student_phone text,
  student_email text,
  parent_name   text,
  parent_phone  text,
  parent_email  text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint students_math_level_only_11_12 check (
    (grade >= 11 and math_level is not null) or (grade <= 10 and math_level is null)
  )
);

create index students_owner_id_idx on public.students (owner_id);
create index students_owner_status_idx on public.students (owner_id, status);

-- Status changes over time (Nepastovus → Pastovus and back, Pauzė, …).
create table public.student_status_history (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  status      public.student_status not null,
  valid_from  date not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index student_status_history_owner_id_idx on public.student_status_history (owner_id);
create index student_status_history_student_idx on public.student_status_history (student_id, valid_from desc);

-- ---------------------------------------------------------------------------
-- schedule_slots — weekly times; closing one and opening a new one keeps history
-- ---------------------------------------------------------------------------

create table public.schedule_slots (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  weekday     smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday … 7 = Sunday
  start_time  time not null,                                     -- local Europe/Vilnius time
  valid_from  date not null,
  valid_to    date,                                              -- null = still active
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint schedule_slots_valid_range check (valid_to is null or valid_to >= valid_from)
);

create index schedule_slots_owner_id_idx on public.schedule_slots (owner_id);
create index schedule_slots_student_idx on public.schedule_slots (student_id);
create index schedule_slots_active_idx on public.schedule_slots (owner_id, weekday) where valid_to is null;

-- ---------------------------------------------------------------------------
-- lessons
-- ---------------------------------------------------------------------------

create table public.lessons (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id          uuid not null references public.students (id) on delete cascade,
  slot_id             uuid references public.schedule_slots (id) on delete set null,
  starts_at           timestamptz not null,
  duration_minutes    smallint not null default 60 check (duration_minutes > 0),
  price               numeric(8, 2) not null check (price >= 0), -- snapshot when the lesson is created
  kind                public.lesson_kind not null default 'regular',
  status              public.lesson_status not null default 'suplanuota',
  original_starts_at  timestamptz, -- set when only this lesson was moved ("Tik šią pamoką")
  cancelled_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint lessons_cancelled_at check ((status = 'atsaukta') = (cancelled_at is not null))
);

create index lessons_owner_id_idx on public.lessons (owner_id);
create index lessons_owner_starts_at_idx on public.lessons (owner_id, starts_at);
create index lessons_student_starts_at_idx on public.lessons (student_id, starts_at desc);
create index lessons_slot_id_idx on public.lessons (slot_id);

-- Rolling generation is idempotent: one lesson per slot per original occurrence.
create unique index lessons_slot_occurrence_key
  on public.lessons (slot_id, (coalesce(original_starts_at, starts_at)))
  where slot_id is not null;

-- Lesson notes — one per lesson.
create table public.lesson_notes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id   uuid not null unique references public.lessons (id) on delete cascade,
  done        text, -- Ką darėm
  stopped_at  text, -- Kur baigėm
  homework    text, -- ND
  next_start  text, -- Kitą kartą pradėti nuo
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index lesson_notes_owner_id_idx on public.lesson_notes (owner_id);

-- ---------------------------------------------------------------------------
-- gaps (spragos)
-- ---------------------------------------------------------------------------

create table public.gaps (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id   uuid not null references public.students (id) on delete cascade,
  text         text not null check (length(trim(text)) > 0),
  resolved_at  timestamptz, -- null = still open
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index gaps_owner_id_idx on public.gaps (owner_id);
create index gaps_student_open_idx on public.gaps (student_id) where resolved_at is null;

-- ---------------------------------------------------------------------------
-- payments + payer_aliases
-- balance = Σ payments − Σ price of lessons with status 'ivyko'
-- ---------------------------------------------------------------------------

create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id           uuid references public.students (id) on delete set null, -- null = not assigned yet
  amount               numeric(10, 2) not null check (amount <> 0),
  booked_on            date not null,
  payer_name           text,
  payer_iban           text,
  remittance           text,
  bank_transaction_id  text,
  source               public.payment_source not null default 'manual',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint payments_bank_transaction_unique unique (owner_id, bank_transaction_id)
);

create index payments_owner_id_idx on public.payments (owner_id);
create index payments_student_booked_idx on public.payments (student_id, booked_on desc);
create index payments_unassigned_idx on public.payments (owner_id, booked_on desc) where student_id is null;

-- "Prisiminti šį mokėtoją": payer name / IBAN → student.
create table public.payer_aliases (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  payer_name  text,
  payer_iban  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint payer_aliases_has_key check (payer_name is not null or payer_iban is not null)
);

create index payer_aliases_owner_id_idx on public.payer_aliases (owner_id);
create index payer_aliases_student_idx on public.payer_aliases (student_id);
create unique index payer_aliases_iban_key on public.payer_aliases (owner_id, payer_iban) where payer_iban is not null;
create unique index payer_aliases_name_key on public.payer_aliases (owner_id, lower(payer_name)) where payer_iban is null;

-- ---------------------------------------------------------------------------
-- settings — key/value per user (tax rates, quick links, …); values are JSON
-- ---------------------------------------------------------------------------

create table public.settings (
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key         text not null check (key ~ '^[a-z0-9_.]+$'),
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (owner_id, key)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger students_set_updated_at before update on public.students
  for each row execute function public.set_updated_at();
create trigger schedule_slots_set_updated_at before update on public.schedule_slots
  for each row execute function public.set_updated_at();
create trigger lessons_set_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();
create trigger lesson_notes_set_updated_at before update on public.lesson_notes
  for each row execute function public.set_updated_at();
create trigger gaps_set_updated_at before update on public.gaps
  for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger payer_aliases_set_updated_at before update on public.payer_aliases
  for each row execute function public.set_updated_at();
create trigger settings_set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- The trigger function is not an API endpoint.
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security + grants (owner only, authenticated only)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'students', 'student_status_history', 'schedule_slots', 'lessons', 'lesson_notes',
    'gaps', 'payments', 'payer_aliases', 'settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);

    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select auth.uid()) = owner_id)
         with check ((select auth.uid()) = owner_id)',
      t || '_owner_only', t
    );
  end loop;
end;
$$;
