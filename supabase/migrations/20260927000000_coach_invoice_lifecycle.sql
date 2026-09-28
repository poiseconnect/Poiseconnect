begin;

alter table public.therapist_invoice_settings
  add column if not exists business_country_code text,
  add column if not exists vat_number text,
  add column if not exists uid_confirmed_at timestamptz,
  add column if not exists uid_confirmed_by uuid;

alter table public.coach_invoices
  add column if not exists tax_treatment text,
  add column if not exists tax_reason text;

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
      and conname = 'coach_invoices_tax_treatment_check'
  ) then
    alter table public.coach_invoices
      add constraint coach_invoices_tax_treatment_check
      check (
        tax_treatment is null
        or tax_treatment in ('vat', 'reverse_charge', 'review_required')
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

commit;