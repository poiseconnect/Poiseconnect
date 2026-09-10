begin;

alter table public.anfragen
  add column if not exists draft_recovery_consent boolean not null default false,
  add column if not exists draft_recovery_consent_at timestamptz,
  add column if not exists draft_recovery_consent_version text,
  add column if not exists draft_last_activity_at timestamptz,
  add column if not exists draft_current_step integer,
  add column if not exists draft_reminder_sent_at timestamptz;

commit;
