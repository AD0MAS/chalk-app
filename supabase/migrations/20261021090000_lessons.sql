-- Chalk — lessons (docs/SPEC.md §1 Lesson): effective status, rolling generation, safe pruning.
--
-- All three are plain SQL so that times are computed by Postgres in Europe/Vilnius,
-- which handles daylight saving time correctly (e.g. 2026-10-25, 04:00 → 03:00).
-- Functions are SECURITY INVOKER: Row Level Security still applies to every row they touch.

-- A short reason shown next to a cancelled lesson ("Sirgo"). Optional.
alter table public.lessons add column cancel_reason text check (length(cancel_reason) <= 200);

-- ---------------------------------------------------------------------------
-- lessons_view — the ONE place where "Įvyko" is derived.
-- A lesson that was not cancelled and whose end time has passed counts as 'ivyko'.
-- Balances and every screen read `effective_status` from here.
-- ---------------------------------------------------------------------------

create view public.lessons_view
with (security_invoker = true)
as
select
  l.*,
  case
    when l.status = 'suplanuota' and l.starts_at + make_interval(mins => l.duration_minutes) <= now()
      then 'ivyko'::public.lesson_status
    else l.status
  end as effective_status
from public.lessons l;

revoke all on table public.lessons_view from anon, authenticated;
grant select on table public.lessons_view to authenticated;

-- ---------------------------------------------------------------------------
-- generate_lessons() — rolling generation of regular lessons 4 weeks ahead.
--
-- * one lesson per active weekly slot occurrence, from today (Vilnius) up to today + 28 days;
-- * never before 2026-10-21 (Chalk starts counting lessons that day) and never before a slot's valid_from;
-- * only for students who are not on Pauzė or archived;
-- * idempotent: the unique index lessons_slot_occurrence_key skips occurrences that already exist,
--   including lessons that were moved ("Tik šią pamoką" keeps original_starts_at) or cancelled.
-- Returns how many lessons were created.
-- ---------------------------------------------------------------------------

create function public.generate_lessons()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Vilnius')::date;
  v_from  date := greatest(v_today, date '2026-10-21');
  v_to    date := v_today + 28;
  v_count integer;
begin
  insert into public.lessons (owner_id, student_id, slot_id, starts_at, duration_minutes, price, kind)
  select
    s.owner_id,
    s.student_id,
    s.id,
    (d.day + s.start_time) at time zone 'Europe/Vilnius', -- local wall-clock time → timestamptz
    60,
    st.price,
    'regular'
  from public.schedule_slots s
  join public.students st on st.id = s.student_id
  cross join lateral (
    select g::date as day
    from generate_series(
      greatest(v_from, s.valid_from)::timestamp,
      least(v_to, coalesce(s.valid_to, v_to))::timestamp,
      interval '1 day'
    ) g
  ) d
  where st.status not in ('pauze', 'archyvuotas')
    and extract(isodow from d.day) = s.weekday
  on conflict (slot_id, (coalesce(original_starts_at, starts_at))) where slot_id is not null
  do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- prune_planned_lessons(slot, from) — removes a slot's future lessons from a date on,
-- so they can be regenerated (new weekly time, Pauzė, …).
--
-- Only lessons that nobody has touched are removed: status 'suplanuota', not moved
-- (original_starts_at is null), starting in the future and without notes.
-- Past, cancelled and moved lessons always stay. Returns how many were removed.
-- ---------------------------------------------------------------------------

create function public.prune_planned_lessons(p_slot_id uuid, p_from date)
returns integer
language sql
security invoker
set search_path = ''
as $$
  with removed as (
    delete from public.lessons l
    where l.slot_id = p_slot_id
      and l.status = 'suplanuota'
      and l.original_starts_at is null
      and l.starts_at > now()
      and (l.starts_at at time zone 'Europe/Vilnius')::date >= p_from
      and not exists (select 1 from public.lesson_notes n where n.lesson_id = l.id)
    returning 1
  )
  select count(*)::integer from removed;
$$;

-- ---------------------------------------------------------------------------
-- reschedule_series(lesson, new start) — "Nuo dabar visam laikui".
--
-- In one transaction:
--   1. a new slot opens on the new weekday/time from the new date;
--   2. the lesson itself moves into the new slot at the new time;
--   3. the old slot's later untouched lessons are pruned (see above);
--   4. the old slot ends the day before this lesson's (original) date
--      — or is removed if this was its very first day;
--   5. lessons are regenerated.
-- Returns the new slot id.
-- ---------------------------------------------------------------------------

create function public.reschedule_series(p_lesson_id uuid, p_new_start timestamptz)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lesson     public.lessons;
  v_slot       public.schedule_slots;
  v_cut        date;
  v_local      timestamp := p_new_start at time zone 'Europe/Vilnius';
  v_new_slot   uuid;
begin
  select * into v_lesson from public.lessons where id = p_lesson_id for update;
  if not found then
    raise exception 'Pamoka nerasta';
  end if;
  if v_lesson.slot_id is null or v_lesson.status <> 'suplanuota' or v_lesson.starts_at <= now() then
    raise exception 'Visam laikui galima perkelti tik būsimą savaitinę pamoką';
  end if;
  if v_local::date < (now() at time zone 'Europe/Vilnius')::date then
    raise exception 'Nauja data negali būti praeityje';
  end if;

  select * into v_slot from public.schedule_slots where id = v_lesson.slot_id for update;
  v_cut := (coalesce(v_lesson.original_starts_at, v_lesson.starts_at) at time zone 'Europe/Vilnius')::date;

  -- 1. the new weekly slot
  insert into public.schedule_slots (owner_id, student_id, weekday, start_time, valid_from)
  values (v_slot.owner_id, v_slot.student_id, extract(isodow from v_local)::smallint, v_local::time, v_local::date)
  returning id into v_new_slot;

  -- 2. this lesson becomes the first lesson of the new slot
  update public.lessons
     set slot_id = v_new_slot, starts_at = p_new_start, original_starts_at = null
   where id = v_lesson.id;

  -- 3. the old slot's later untouched lessons go away
  perform public.prune_planned_lessons(v_slot.id, v_cut);

  -- 4. close the old slot — or remove it if it never really started
  --    (its remaining moved/cancelled lessons, if any, keep existing without a slot)
  if v_cut <= v_slot.valid_from then
    delete from public.schedule_slots where id = v_slot.id;
  elsif v_slot.valid_to is null or v_slot.valid_to >= v_cut then
    update public.schedule_slots set valid_to = v_cut - 1 where id = v_slot.id;
  end if;

  -- 5. fill in the new slot's lessons
  perform public.generate_lessons();
  return v_new_slot;
end;
$$;

-- Only logged-in users may call them (RLS decides which rows); the backup scripts don't need them.
revoke execute on function public.generate_lessons() from public, anon;
revoke execute on function public.prune_planned_lessons(uuid, date) from public, anon;
revoke execute on function public.reschedule_series(uuid, timestamptz) from public, anon;
grant execute on function public.generate_lessons() to authenticated;
grant execute on function public.prune_planned_lessons(uuid, date) to authenticated;
grant execute on function public.reschedule_series(uuid, timestamptz) to authenticated;
