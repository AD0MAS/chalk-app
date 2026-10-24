-- Backup / restore scripts (scripts/backup.mts, scripts/restore.mts) use the secret key,
-- i.e. the service_role. Because new tables are not exposed automatically, service_role
-- has no table privileges yet. Give it exactly what the scripts need:
--   backup  → select
--   restore → select, insert, delete (it replaces all rows; no update needed)
-- service_role is never used in the app itself and never in the browser.

grant select, insert, delete on table
  public.students,
  public.student_status_history,
  public.schedule_slots,
  public.lessons,
  public.lesson_notes,
  public.gaps,
  public.payments,
  public.payer_aliases,
  public.settings
to service_role;
