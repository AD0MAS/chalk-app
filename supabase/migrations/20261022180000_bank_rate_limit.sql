-- Chalk — bank request budget (PSD2, EBA RTS Art. 31(5)): without Adomas online the bank allows at most
-- 4 account-information requests per 24 h. See lib/bank/budget.ts.
--
--   * bank_calls  — every bank request of the last 24 h: [{ at, account, attended }] (older ones are dropped);
--   * retry_after — after a 429 no bank request is made before this time.

alter table public.bank_connection
  add column bank_calls  jsonb not null default '[]',
  add column retry_after timestamptz;

-- The 429 of the 2026-10-22 cron was stored as an error (Coral dot). It is a pause, not an error:
-- turn it into retry_after (6 h after that attempt, Enable Banking's advice) and clear the error.
update public.bank_connection
set retry_after = last_attempt_at + interval '6 hours',
    last_error  = null
where last_error like 'Bankas laikinai riboja%';
