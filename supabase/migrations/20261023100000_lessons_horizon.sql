-- Chalk – lesson generation horizon: until the end of NEXT month (Vilnius dates) instead of today + 28 days,
-- so the current month is always complete (Finansai "Prognozė" never misses lessons).
--   2026-10-23 → 2026-11-30 · 2026-10-31 → 2026-11-30 · 2026-11-01 → 2026-12-31 · 2026-12-31 → 2027-01-31
-- Everything else in generate_lessons() is unchanged (see 20261021090000_lessons.sql).

-- ---------------------------------------------------------------------------
-- lessons_horizon(day) — the last day generate_lessons() fills: the last day of the month after `day`.
-- Pure; its own function so the rule can be checked with any date.
-- ---------------------------------------------------------------------------

create function public.lessons_horizon(p_day date)
returns date
language sql
immutable
set search_path = ''
as $$
  select (date_trunc('month', p_day::timestamp) + interval '2 months' - interval '1 day')::date;
$$;

revoke execute on function public.lessons_horizon(date) from public, anon;
grant execute on function public.lessons_horizon(date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- generate_lessons() — rolling generation of regular lessons until the end of next month.
--
-- * one lesson per active weekly slot occurrence, from today (Vilnius) up to lessons_horizon(today);
-- * never before 2026-10-21 (Chalk starts counting lessons that day) and never before a slot's valid_from;
-- * only for students who are not on Pauzė or archived;
-- * idempotent: the unique index lessons_slot_occurrence_key skips occurrences that already exist,
--   including lessons that were moved ("Tik šią pamoką" keeps original_starts_at) or cancelled.
-- Returns how many lessons were created. `create or replace` keeps the existing grants.
-- ---------------------------------------------------------------------------

create or replace function public.generate_lessons()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Vilnius')::date;
  v_from  date := greatest(v_today, date '2026-10-21');
  v_to    date := public.lessons_horizon(v_today);
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
