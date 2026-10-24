-- Chalk — money (docs/SPEC.md §1 Money, Payments): opening balance, payment note, balances.
--
-- balance = opening balance + Σ payments − Σ price of lessons that count as Įvyko.
-- Negative = debt, positive = prepaid. Cancelled lessons are never charged.

-- "Pradinis likutis": one opening balance per student, as of 2026-10-21 (the day Chalk starts
-- counting lessons). Negative = the student owed money that day, positive = prepaid. Default 0.
alter table public.students add column opening_balance numeric(10, 2) not null default 0;

-- A short note on a manual payment ("grynieji po pamokos"). Bank payments keep their own remittance text.
alter table public.payments add column note text check (length(note) <= 300);

-- ---------------------------------------------------------------------------
-- student_balances — the ONE place where a balance is computed.
-- Every screen (Mokiniai, profile, Šiandien, Mokėjimai) reads from here, so they always agree.
-- "Held" comes from lessons_view.effective_status, the one place where Įvyko is derived.
-- ---------------------------------------------------------------------------

create view public.student_balances
with (security_invoker = true)
as
select
  s.id as student_id,
  s.opening_balance,
  coalesce(p.paid, 0)::numeric(10, 2) as paid,
  coalesce(l.charged, 0)::numeric(10, 2) as charged,
  coalesce(l.held_count, 0)::integer as held_count,
  (s.opening_balance + coalesce(p.paid, 0) - coalesce(l.charged, 0))::numeric(10, 2) as balance
from public.students s
left join lateral (
  select sum(pay.amount) as paid
  from public.payments pay
  where pay.student_id = s.id
) p on true
left join lateral (
  select sum(lv.price) as charged, count(*) as held_count
  from public.lessons_view lv
  where lv.student_id = s.id
    and lv.effective_status = 'ivyko'
) l on true;

revoke all on table public.student_balances from anon, authenticated;
grant select on table public.student_balances to authenticated;
