begin;

alter table public.therapist_invoice_settings
  add column if not exists business_country_code text,
  add column if not exists vat_number text,
  add column if not exists uid_confirmed_at timestamptz,
  add column if not exists uid_confirmed_by uuid;

alter table public.coach_invoices
  add column if not exists invoice_status text,
  add column if not exists tax_treatment text,
  add column if not exists tax_reason text,
  add column if not exists source_snapshot jsonb,
  add column if not exists finalized_at timestamptz,
  add column if not exists finalized_by uuid;

do $$
declare
  vat_number_type text;
begin
  if to_regclass('public.coach_invoices_unique_idx') is null then
    raise exception 'Expected public.coach_invoices_unique_idx is missing';
  end if;

  select data_type
    into vat_number_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'therapist_invoice_settings'
    and column_name = 'vat_number';

  if vat_number_type not in ('text', 'character varying') then
    raise exception 'therapist_invoice_settings.vat_number must be text, found %',
      coalesce(vat_number_type, '<missing>');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.coach_invoices'::regclass
      and conname = 'coach_invoices_invoice_status_check'
  ) then
    alter table public.coach_invoices
      add constraint coach_invoices_invoice_status_check
      check (invoice_status is null or invoice_status in ('draft', 'finalized'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.coach_invoices'::regclass
      and conname = 'coach_invoices_tax_treatment_check'
  ) then
    alter table public.coach_invoices
      add constraint coach_invoices_tax_treatment_check
      check (
        tax_treatment is null
        or tax_treatment in ('vat', 'reverse_charge', 'review_required')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.coach_invoices'::regclass
      and conname = 'coach_invoices_finalized_snapshot_check'
  ) then
    alter table public.coach_invoices
      add constraint coach_invoices_finalized_snapshot_check
      check (
        invoice_status is distinct from 'finalized'
        or (
          finalized_at is not null
          and finalized_by is not null
          and source_snapshot is not null
          and tax_treatment in ('vat', 'reverse_charge')
        )
      );
  end if;
end;
$$;

create or replace function public.invalidate_coach_uid_confirmation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.vat_number is distinct from new.vat_number
    or old.business_country_code is distinct from new.business_country_code then
    new.uid_confirmed_at := null;
    new.uid_confirmed_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists therapist_invoice_settings_uid_confirmation_guard
  on public.therapist_invoice_settings;

create trigger therapist_invoice_settings_uid_confirmation_guard
before update of vat_number, business_country_code
on public.therapist_invoice_settings
for each row
execute function public.invalidate_coach_uid_confirmation();

create or replace function public.protect_coach_invoice_lifecycle()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.invoice_status is null or old.invoice_status = 'finalized' then
      raise exception 'Legacy and finalized coach invoices are read-only'
        using errcode = '55000';
    end if;
    return old;
  end if;

  if old.invoice_status is null then
    raise exception 'Legacy coach invoices are read-only'
      using errcode = '55000';
  end if;

  if old.invoice_status = 'draft'
    and (
      new.invoice_status is null
      or new.invoice_status not in ('draft', 'finalized')
    ) then
    raise exception 'Draft coach invoice has an invalid lifecycle transition'
      using errcode = '55000';
  end if;

  if old.invoice_status = 'finalized' then
    if (to_jsonb(new) - array[
      'sevdesk_invoice_id',
      'sevdesk_invoice_number',
      'sevdesk_synced_at',
      'updated_at',
      'updated_by'
    ]) is distinct from (to_jsonb(old) - array[
      'sevdesk_invoice_id',
      'sevdesk_invoice_number',
      'sevdesk_synced_at',
      'updated_at',
      'updated_by'
    ]) then
      raise exception 'Finalized coach invoice content is immutable'
        using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists coach_invoices_lifecycle_guard
  on public.coach_invoices;

create trigger coach_invoices_lifecycle_guard
before update or delete
on public.coach_invoices
for each row
execute function public.protect_coach_invoice_lifecycle();

commit;