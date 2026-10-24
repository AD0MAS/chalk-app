-- Chalk — Phase 4: Finansai + IV taxes (docs/SPEC.md §1 Taxes).
--
--   * historical_income — "istorinės pajamos": money received before Chalk counted payments
--     (a private income spreadsheet and a bank statement for the weeks before bank sync). No student, never part of a
--     balance; counts only for taxes and the apskaitos žurnalas. Imported once by a private script.
--   * settings 'tax' — tax rates and thresholds, prefilled with 2026 values, editable in Nustatymai.

-- ---------------------------------------------------------------------------
-- historical_income
-- ---------------------------------------------------------------------------

create table public.historical_income (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  received_on  date not null,
  amount       numeric(10, 2) not null check (amount > 0),
  payer_name   text,
  note         text check (length(note) <= 300),
  source       text not null check (source in ('xlsx', 'statement', 'manual')),
  import_key   text,                                   -- makes the one-off import idempotent
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint historical_income_import_key unique (owner_id, import_key)
);

create index historical_income_owner_received_idx on public.historical_income (owner_id, received_on);

create trigger historical_income_set_updated_at before update on public.historical_income
  for each row execute function public.set_updated_at();

alter table public.historical_income enable row level security;
revoke all on table public.historical_income from anon, authenticated;
-- The app only reads it; rows come from the import script (service_role).
grant select on table public.historical_income to authenticated;
create policy historical_income_owner_select on public.historical_income for select to authenticated
  using ((select auth.uid()) = owner_id);

-- import script → insert; backup → select; restore → select, insert, delete
grant select, insert, delete on table public.historical_income to service_role;

-- ---------------------------------------------------------------------------
-- Tax settings, 2026 values ("pasitikrink VMI / Sodra"). One row per user; the app falls back to the same
-- values if the row is missing (lib/tax/constants.ts).
--   GPM: 20 % of taxable income minus a credit: credit_rate × taxable up to credit_full_until,
--        falling linearly to 0 at credit_zero_at (= 0.15 − 2/300 000 × (taxable − 20 000)).
--   VSD 12.52 %, PSD 6.98 % of base_share (90 %) of taxable income.
--   min_psd: off while Adomas studies full-time (the state pays his PSD).
-- ---------------------------------------------------------------------------

insert into public.settings (owner_id, key, value)
select id, 'tax', '{
  "rates_year": 2026,
  "deduction": "norm",
  "norm_rate": 0.30,
  "actual_expenses": 0,
  "gpm_rate": 0.20,
  "credit_rate": 0.15,
  "credit_full_until": 20000,
  "credit_zero_at": 42500,
  "vsd_rate": 0.1252,
  "psd_rate": 0.0698,
  "base_share": 0.90,
  "min_psd": false,
  "min_psd_monthly": 80.48
}'::jsonb
from auth.users
on conflict (owner_id, key) do nothing;
