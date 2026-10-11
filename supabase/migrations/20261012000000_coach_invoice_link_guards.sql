begin;

alter table public.coach_invoices
  add column if not exists sevdesk_creation_candidate_id text;

-- Unique claims protect concurrent new bindings even at REPEATABLE READ.
-- Existing invoice rows are neither backfilled nor changed.
create table if not exists public.coach_invoice_sevdesk_claims (
  sevdesk_invoice_id text primary key check (sevdesk_invoice_id ~ '^[1-9][0-9]*$'),
  coach_invoice_id uuid not null unique references public.coach_invoices(id),
  created_at timestamptz not null default now()
);
alter table public.coach_invoice_sevdesk_claims enable row level security;
revoke all on public.coach_invoice_sevdesk_claims from anon, authenticated, service_role;
grant select on public.coach_invoice_sevdesk_claims to service_role;

create or replace function public.check_coach_invoice_link(p_invoice_id uuid)
returns text
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.coach_invoices;
  v_id text;
begin
  select * into v_invoice from public.coach_invoices where id = p_invoice_id;
  if not found then return 'missing'; end if;
  v_id := nullif(btrim(v_invoice.sevdesk_invoice_id::text), '');
  if v_id is null then return 'unlinked'; end if;
  if v_id in ('135675889', '135833778') then return 'quarantined'; end if;
  if v_id !~ '^[1-9][0-9]*$' then return 'quarantined'; end if;
  if exists (
    select 1 from public.coach_invoices i
    where i.id <> v_invoice.id
      and nullif(btrim(i.sevdesk_invoice_id::text), '') = v_id
  ) then return 'ambiguous'; end if;
  return 'unique';
end;
$$;

create or replace function public.guard_coach_invoice_link()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_old_id text;
  v_new_id text;
begin
  if tg_op <> 'INSERT' then
    v_old_id := nullif(btrim(old.sevdesk_invoice_id::text), '');
    if public.check_coach_invoice_link(old.id) in ('ambiguous', 'quarantined') then
      raise exception 'sevdesk_invoice_link_conflict' using errcode = '23505';
    end if;
    if v_old_id is not null then
      raise exception 'linked_coach_invoice_is_readonly' using errcode = '55000';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  v_new_id := nullif(btrim(new.sevdesk_invoice_id::text), '');
  if v_new_id is not null then
    if tg_op = 'INSERT' then
      raise exception 'sevdesk_link_requires_creation_reservation' using errcode = '55000';
    end if;
    if old.sevdesk_send_status <> 'creating'
      or old.sevdesk_send_status is null or new.sevdesk_send_status <> 'created'
      or new.sevdesk_send_status is null then
      raise exception 'sevdesk_link_requires_creation_reservation' using errcode = '55000';
    end if;
    if v_new_id !~ '^[1-9][0-9]*$'
      or v_new_id in ('135675889', '135833778') then
      raise exception 'sevdesk_invoice_link_conflict' using errcode = '23505';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('sevdesk-invoice:' || v_new_id, 752942));
    if exists (
      select 1 from public.coach_invoices i
      where i.id <> new.id
        and nullif(btrim(i.sevdesk_invoice_id::text), '') = v_new_id
    ) then
      raise exception 'sevdesk_invoice_link_conflict' using errcode = '23505';
    end if;
    begin
      insert into public.coach_invoice_sevdesk_claims(sevdesk_invoice_id, coach_invoice_id)
      values (v_new_id, new.id);
    exception when unique_violation then
      raise exception 'sevdesk_invoice_link_conflict' using errcode = '23505';
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists coach_invoice_00_link_write_guard on public.coach_invoices;
create trigger coach_invoice_00_link_write_guard
before insert or update or delete on public.coach_invoices
for each row execute function public.guard_coach_invoice_link();

create or replace function public.reserve_coach_invoice_creation(
  p_invoice_id uuid,
  p_admin_id uuid,
  p_release_version integer,
  p_expected_updated_at timestamptz
)
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.coach_invoices;
  v_release public.coach_quarter_releases;
  v_snapshot jsonb;
  v_coach_id uuid;
begin
  select coach_id into v_coach_id from public.coach_invoices where id = p_invoice_id;
  if not found then return 'draft_mismatch'; end if;
  perform public.lock_coach_billing(v_coach_id);
  select * into v_invoice from public.coach_invoices where id = p_invoice_id for update;
  if not found or v_invoice.coach_id is distinct from v_coach_id
    or v_invoice.billing_mode <> 'quartal'
    or v_invoice.billing_mode is null
    or v_invoice.bundle_key not in ('normal_ust', 'reverse_charge')
    or v_invoice.bundle_key is null then
    return 'draft_mismatch';
  end if;
  if public.check_coach_invoice_link(p_invoice_id) in ('ambiguous', 'quarantined') then
    return 'link_conflict';
  end if;
  if exists (
    select 1 from public.coach_invoices i
    where i.coach_id = v_coach_id
      and public.check_coach_invoice_link(i.id) in ('ambiguous', 'quarantined')
  ) then return 'link_conflict'; end if;
  if exists (
    select 1 from public.coach_invoices i
    where i.coach_id = v_coach_id
      and i.sevdesk_send_status in ('creating', 'creation_unknown', 'sending', 'send_unknown')
  ) then return 'blocked'; end if;
  if exists (
    select 1 from public.coach_invoices i
    where i.coach_id = v_coach_id and i.id <> p_invoice_id
      and i.billing_mode = 'quartal'
      and i.billing_year = v_invoice.billing_year
      and i.billing_quarter = v_invoice.billing_quarter
      and i.bundle_key = v_invoice.bundle_key
  ) then return 'duplicate'; end if;
  select * into v_release from public.coach_quarter_releases
    where coach_id = v_coach_id
      and billing_year = v_invoice.billing_year
      and billing_quarter = v_invoice.billing_quarter for update;
  if not found or v_release.release_status <> 'released'
    or v_release.release_version is distinct from p_release_version
    or v_invoice.coach_quarter_release_version is distinct from p_release_version
    then return 'stale'; end if;
  v_snapshot := public.coach_quarter_snapshot(
    v_coach_id, v_invoice.billing_year, v_invoice.billing_quarter
  );
  if v_snapshot is distinct from v_release.snapshot then
    update public.coach_quarter_releases set release_status = 'stale', updated_at = now()
      where id = v_release.id;
    return 'stale';
  end if;
  if v_invoice.updated_at is distinct from p_expected_updated_at
    or v_invoice.sevdesk_invoice_id is not null
    or v_invoice.sevdesk_send_status is not null
    or v_invoice.sevdesk_creation_candidate_id is not null then return 'draft_mismatch'; end if;
  update public.coach_invoices
    set sevdesk_send_status = 'creating', sevdesk_send_requested_by = p_admin_id,
        sevdesk_send_created_at = now(), sevdesk_send_error_code = null, updated_at = now()
    where id = p_invoice_id;
  return 'reserved';
end;
$$;

-- Candidate identity is recovery metadata, never an ordinary invoice edit.
create or replace function public.guard_coach_invoice_creation_update()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.sevdesk_send_status = 'creation_unknown' then
    raise exception 'coach_invoice_manual_reconciliation_required' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    if old.sevdesk_send_status in ('creating', 'creation_unknown', 'created')
      or old.sevdesk_invoice_id is not null then
      raise exception 'coach_invoice_workflow_record_is_protected' using errcode = '55000';
    end if;
    return old;
  end if;
  if old.sevdesk_send_status = 'creating' then
    if (to_jsonb(new) - array[
      'sevdesk_send_status','sevdesk_invoice_id','sevdesk_draft_invoice_number',
      'sevdesk_send_error_code','sevdesk_send_accepted_at','sevdesk_send_email_id',
      'sevdesk_creation_candidate_id','updated_at'
    ]) is distinct from (to_jsonb(old) - array[
      'sevdesk_send_status','sevdesk_invoice_id','sevdesk_draft_invoice_number',
      'sevdesk_send_error_code','sevdesk_send_accepted_at','sevdesk_send_email_id',
      'sevdesk_creation_candidate_id','updated_at'
    ]) then
      raise exception 'coach_invoice_creation_in_progress' using errcode = '55000';
    end if;
    if new.sevdesk_send_status is not null
      and new.sevdesk_send_status not in ('created', 'creation_unknown') then
      raise exception 'invalid_coach_invoice_creation_transition' using errcode = '55000';
    end if;
    if new.sevdesk_send_status = 'created' and new.sevdesk_invoice_id is null then
      raise exception 'created_coach_invoice_requires_sevdesk_id' using errcode = '55000';
    end if;
    if new.sevdesk_send_status is null
      and (new.sevdesk_invoice_id is not null or new.sevdesk_creation_candidate_id is not null) then
      raise exception 'rejected_coach_invoice_cannot_have_sevdesk_id' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.check_coach_invoice_link(uuid) from public, anon, authenticated;
revoke all on function public.guard_coach_invoice_link() from public, anon, authenticated;
grant execute on function public.check_coach_invoice_link(uuid) to service_role;

-- Do not create a unique index here: known historical conflicts must remain
-- unchanged. Claims enforce new identity uniqueness; the trigger also checks
-- the unchanged historical invoice rows.
commit;
