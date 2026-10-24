-- Chalk — Google Calendar one-way sync (docs/SPEC.md §2): Chalk → the "Pamokos" calendar.
--
-- How it works:
--   * every lesson has a deterministic Google event id: 'chalk' + its uuid without dashes
--     (base32hex allows a-v and 0-9), so syncing twice never creates a duplicate;
--   * triggers mark a lesson "dirty" whenever something Google shows changes
--     (time, status, student; or the student's name, grade, Meet / Lenta link);
--   * deleted lessons go into gcal_deletions (the row itself is gone, so it needs an outbox);
--   * the app server (lib/google/sync.ts, service_role) pushes dirty lessons and deletions
--     to Google and clears the flag. A failure only leaves the lesson dirty with gcal_error set.

-- ---------------------------------------------------------------------------
-- lessons: sync state
-- ---------------------------------------------------------------------------

alter table public.lessons
  add column gcal_event_id text,                          -- set once the event exists in Google
  add column gcal_version  integer not null default 1,    -- +1 on every change Google must see
  add column gcal_dirty    boolean not null default true, -- true = Google is not up to date yet
  add column gcal_error    text;                          -- last sync error ("nesinchronizuota")

create index lessons_gcal_dirty_idx on public.lessons (owner_id) where gcal_dirty;

-- New rows (also rows put back by `npm run restore`) are always synced again.
create function public.lessons_gcal_mark()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.gcal_dirty := true;
  elsif new.starts_at is distinct from old.starts_at
     or new.duration_minutes is distinct from old.duration_minutes
     or new.status is distinct from old.status
     or new.student_id is distinct from old.student_id then
    new.gcal_version := old.gcal_version + 1;
    new.gcal_dirty := true;
  end if;
  return new;
end;
$$;

create trigger lessons_gcal_mark
  before insert or update on public.lessons
  for each row execute function public.lessons_gcal_mark();

-- ---------------------------------------------------------------------------
-- gcal_deletions: events to remove because their lesson was deleted
-- (student deleted, prune_planned_lessons, restore, …).
-- Server-only: RLS on, no policies, no grants for anon/authenticated.
-- ---------------------------------------------------------------------------

create table public.gcal_deletions (
  id         bigint generated always as identity primary key,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  lesson_id  uuid not null,
  error      text,
  created_at timestamptz not null default now()
);

alter table public.gcal_deletions enable row level security;
revoke all on table public.gcal_deletions from anon, authenticated;
grant select, update, delete on table public.gcal_deletions to service_role;

-- SECURITY DEFINER: the logged-in user (and the restore script) may not write this table directly.
create function public.lessons_gcal_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.gcal_deletions (owner_id, lesson_id) values (old.owner_id, old.id);
  return old;
end;
$$;

create trigger lessons_gcal_deleted
  after delete on public.lessons
  for each row execute function public.lessons_gcal_deleted();

-- ---------------------------------------------------------------------------
-- students: a new name, grade/level or link changes the title/description of future events.
-- ---------------------------------------------------------------------------

create function public.students_gcal_mark()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.first_name is distinct from old.first_name
     or new.last_name is distinct from old.last_name
     or new.grade is distinct from old.grade
     or new.math_level is distinct from old.math_level
     or new.meet_url is distinct from old.meet_url
     or new.board_url is distinct from old.board_url then
    update public.lessons
       set gcal_version = gcal_version + 1, gcal_dirty = true
     where student_id = new.id
       and starts_at > now()
       and status <> 'atsaukta';
  end if;
  return null;
end;
$$;

create trigger students_gcal_mark
  after update on public.students
  for each row execute function public.students_gcal_mark();

revoke execute on function public.lessons_gcal_mark() from public, anon, authenticated;
revoke execute on function public.lessons_gcal_deleted() from public, anon, authenticated;
revoke execute on function public.students_gcal_mark() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- google_connection: the OAuth refresh token and the "Pamokos" calendar id.
-- Server-only (service_role): the browser can never read the token.
-- One row per owner; on "Atjungti" the token is cleared but calendar_id stays,
-- so reconnecting reuses the same calendar.
-- ---------------------------------------------------------------------------

create table public.google_connection (
  owner_id        uuid primary key references auth.users (id) on delete cascade,
  refresh_token   text,
  scope           text,
  calendar_id     text,
  connected_at    timestamptz,
  last_sync_at    timestamptz,
  last_error      text,
  sync_lock_until timestamptz, -- a running sync holds this; stale locks expire
  updated_at      timestamptz not null default now()
);

create trigger google_connection_set_updated_at
  before update on public.google_connection
  for each row execute function public.set_updated_at();

alter table public.google_connection enable row level security;
revoke all on table public.google_connection from anon, authenticated;
grant select, insert, update, delete on table public.google_connection to service_role;

-- The sync may only change the sync columns of a lesson — nothing else.
grant update (gcal_event_id, gcal_dirty, gcal_error) on table public.lessons to service_role;
