begin;

alter table public.coach_invoices
  add column if not exists sevdesk_send_status text,
  add column if not exists sevdesk_send_requested_by uuid,
  add column if not exists sevdesk_send_created_at timestamptz,
  add column if not exists sevdesk_send_accepted_at timestamptz,
  add column if not exists sevdesk_send_email_id text,
  add column if not exists sevdesk_send_error_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.coach_invoices'::regclass
      and conname = 'coach_invoices_sevdesk_send_status_check'
  ) then
    alter table public.coach_invoices
      add constraint coach_invoices_sevdesk_send_status_check
      check (
        sevdesk_send_status is null
        or sevdesk_send_status in (
          'creating',
          'creation_unknown',
          'created',
          'sending',
          'send_failed',
          'send_unknown',
          'sent'
        )
      );
  end if;
end;
$$;

create index if not exists coach_invoices_sevdesk_send_status_idx
  on public.coach_invoices (sevdesk_send_status)
  where sevdesk_send_status is not null;

commit;