-- Chalk — Phase 3: bank import via Enable Banking + statement upload (docs/SPEC.md §1 Payments).
--
--   * bank payments (source bank / csv) are never deleted — only assigned, re-assigned, unassigned
--     or hidden with a reason ("ne mokinio mokėjimas");
--   * their bank data (amount, date, payer, remittance, id) can never be changed after import;
--   * bank_connection holds the Enable Banking session — server only, like google_connection.

-- ---------------------------------------------------------------------------
-- payments: hide instead of delete
-- ---------------------------------------------------------------------------

alter table public.payments
  add column hidden_at     timestamptz,
  add column hidden_reason text check (length(hidden_reason) <= 200),
  -- a hidden payment belongs to nobody, so it never counts in a balance
  add constraint payments_hidden_unassigned check (hidden_at is null or student_id is null);

-- Bank data stays exactly as the bank sent it. Only student_id, note and the hidden_* columns may change.
create function public.payments_keep_bank_data()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.source <> 'manual' and (
       new.amount is distinct from old.amount
    or new.booked_on is distinct from old.booked_on
    or new.payer_name is distinct from old.payer_name
    or new.payer_iban is distinct from old.payer_iban
    or new.remittance is distinct from old.remittance
    or new.bank_transaction_id is distinct from old.bank_transaction_id
    or new.source is distinct from old.source
  ) then
    raise exception 'Banko mokėjimo duomenų keisti negalima';
  end if;
  return new;
end;
$$;

create trigger payments_keep_bank_data
  before update on public.payments
  for each row execute function public.payments_keep_bank_data();

revoke execute on function public.payments_keep_bank_data() from public, anon, authenticated;

-- RLS: the app may delete manual payments only. (service_role bypasses RLS, so restore still works.)
drop policy payments_owner_only on public.payments;

create policy payments_owner_select on public.payments for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy payments_owner_insert on public.payments for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy payments_owner_update on public.payments for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy payments_owner_delete_manual on public.payments for delete to authenticated
  using ((select auth.uid()) = owner_id and source = 'manual');

-- ---------------------------------------------------------------------------
-- bank_connection: the Enable Banking session, one row per owner.
-- Server-only (service_role): RLS on, no policies, no grants for anon/authenticated.
-- The session id alone is useless without the app's private key, but it still never reaches the browser.
-- ---------------------------------------------------------------------------

create table public.bank_connection (
  owner_id            uuid primary key references auth.users (id) on delete cascade,
  session_id          text,                             -- null = not connected
  aspsp_name          text,
  accounts            jsonb not null default '[]',      -- [{ uid, iban, name, currency }]
  valid_until         timestamptz,                      -- consent expiry ("Pratęsti" before it)
  connected_at        timestamptz,
  import_approved_at  timestamptz,                      -- Adomas approved the first import (npm run bank:preview -- --apply)
  last_sync_at        timestamptz,                      -- last successful sync
  last_attempt_at     timestamptz,                      -- throttle: app-open sync at most once an hour
  last_imported       integer,
  last_error          text,
  sync_lock_until     timestamptz,                      -- a running sync holds this; stale locks expire
  updated_at          timestamptz not null default now()
);

create trigger bank_connection_set_updated_at
  before update on public.bank_connection
  for each row execute function public.set_updated_at();

alter table public.bank_connection enable row level security;
revoke all on table public.bank_connection from anon, authenticated;
grant select, insert, update, delete on table public.bank_connection to service_role;

-- The bank sync (service_role) only inserts payments and reads payer_aliases — both already granted
-- (20261020200000_service_role_backup_grants.sql). It never updates or deletes a payment.
