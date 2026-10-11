begin;

create table if not exists public.coach_quarter_releases (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.team_members(id) on delete cascade,
  billing_year integer not null,
  billing_quarter integer not null check (billing_quarter between 1 and 4),
  release_version integer not null default 0,
  release_status text not null default 'stale'
    check (release_status in ('released', 'stale')),
  snapshot jsonb not null,
  released_at timestamptz,
  released_by uuid references public.team_members(id),
  updated_at timestamptz not null default now(),
  unique (coach_id, billing_year, billing_quarter)
);

alter table public.coach_invoices
  add column if not exists coach_quarter_release_version integer,
  add column if not exists sevdesk_draft_invoice_number text;

alter table public.coach_invoices
  drop constraint if exists coach_invoices_sevdesk_send_status_check;

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
      'sent',
      'finalized'
    )
  );

create index if not exists coach_quarter_releases_status_idx
  on public.coach_quarter_releases (release_status, billing_year, billing_quarter);

alter table public.coach_quarter_releases enable row level security;
revoke all on public.coach_quarter_releases from anon, authenticated;
grant all on public.coach_quarter_releases to service_role;

create or replace function public.coach_quarter_snapshot(
  p_coach_id uuid,
  p_billing_year integer,
  p_billing_quarter integer
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with quarter_bounds as (
    select
      make_timestamptz(
        p_billing_year,
        ((p_billing_quarter - 1) * 3) + 1,
        1, 0, 0, 0, 'Europe/Vienna'
      ) as starts_at,
      make_timestamptz(
        p_billing_year + case when p_billing_quarter = 4 then 1 else 0 end,
        case when p_billing_quarter = 4
          then 1
          else ((p_billing_quarter - 1) * 3) + 4
        end,
        1, 0, 0, 0, 'Europe/Vienna'
      ) as ends_at
  )
  select jsonb_build_object(
    'sessions',
    coalesce((
      select jsonb_agg(
        jsonb_build_array(
          s.id,
          s.date,
          s.price,
          s.therapist_id,
          s.anfrage_id,
          a.invoice_with_vat,
          a.beschaeftigungsgrad
        ) order by s.date, s.id
      )
      from public.sessions s
      left join public.anfragen a on a.id = s.anfrage_id
      cross join quarter_bounds q
      where s.therapist_id in (
          p_coach_id,
          (select m.user_id from public.team_members m where m.id = p_coach_id)
        )
        and s.date >= q.starts_at
        and s.date < q.ends_at
    ), '[]'::jsonb),
    'coach_tax_profile',
    coalesce((
      select jsonb_build_object(
        'company_name', t.company_name,
        'address', t.address,
        'default_vat_rate', t.default_vat_rate,
        'business_country_code', t.business_country_code,
        'vat_number', t.vat_number,
        'uid_confirmed_at', t.uid_confirmed_at,
        'uid_confirmed_by', t.uid_confirmed_by
      )
      from public.therapist_invoice_settings t
      where t.therapist_id = p_coach_id
    ), '{}'::jsonb),
    'coach_account',
    coalesce((
      select jsonb_build_object(
        'user_id', m.user_id,
        'email', m.email,
        'profile_name', m.profile_name,
        'name', m.name,
        'sevdesk_contact_id', m.sevdesk_contact_id,
        'active', m.active,
        'role', m.role
      )
      from public.team_members m
      where m.id = p_coach_id
    ), '{}'::jsonb)
  );
$$;

create or replace function public.release_coach_quarter(
  p_coach_id uuid,
  p_billing_year integer,
  p_billing_quarter integer,
  p_released_by uuid
)
returns public.coach_quarter_releases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_snapshot jsonb;
  v_release public.coach_quarter_releases;
begin
  if p_billing_year < 2000 or p_billing_year > 9999
    or p_billing_quarter < 1 or p_billing_quarter > 4 then
    raise exception 'invalid_quarter';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_coach_id::text),
    (p_billing_year * 10) + p_billing_quarter
  );
  v_snapshot := public.coach_quarter_snapshot(
    p_coach_id, p_billing_year, p_billing_quarter
  );
  if jsonb_array_length(v_snapshot->'sessions') = 0 then
    raise exception 'quarter_has_no_sessions';
  end if;

  insert into public.coach_quarter_releases (
    coach_id,
    billing_year,
    billing_quarter,
    release_version,
    release_status,
    snapshot,
    released_at,
    released_by,
    updated_at
  )
  values (
    p_coach_id,
    p_billing_year,
    p_billing_quarter,
    1,
    'released',
    v_snapshot,
    now(),
    p_released_by,
    now()
  )
  on conflict (coach_id, billing_year, billing_quarter)
  do update set
    release_version = public.coach_quarter_releases.release_version + 1,
    release_status = 'released',
    snapshot = excluded.snapshot,
    released_at = excluded.released_at,
    released_by = excluded.released_by,
    updated_at = excluded.updated_at
  returning * into v_release;
  return v_release;
end;
$$;

create or replace function public.reserve_coach_invoice_creation(
  p_invoice_id uuid,
  p_admin_id uuid,
  p_release_version integer,
  p_expected_updated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.coach_invoices;
  v_release public.coach_quarter_releases;
  v_snapshot jsonb;
begin
  select * into v_invoice
  from public.coach_invoices
  where id = p_invoice_id
  for update;
  if not found or v_invoice.billing_mode <> 'quartal' then
    return 'draft_mismatch';
  end if;

  select * into v_release
  from public.coach_quarter_releases
  where coach_id = v_invoice.coach_id
    and billing_year = v_invoice.billing_year
    and billing_quarter = v_invoice.billing_quarter
  for update;
  if not found
    or v_release.release_status <> 'released'
    or v_release.release_version <> p_release_version
    or v_invoice.coach_quarter_release_version <> p_release_version then
    return 'stale';
  end if;

  v_snapshot := public.coach_quarter_snapshot(
    v_invoice.coach_id,
    v_invoice.billing_year,
    v_invoice.billing_quarter
  );
  if v_snapshot is distinct from v_release.snapshot then
    update public.coach_quarter_releases
      set release_status = 'stale', updated_at = now()
      where id = v_release.id;
    return 'stale';
  end if;

  if v_invoice.updated_at is distinct from p_expected_updated_at
    or v_invoice.sevdesk_invoice_id is not null
    or v_invoice.sevdesk_send_status is not null then
    return 'draft_mismatch';
  end if;

  update public.coach_invoices
  set sevdesk_send_status = 'creating',
      sevdesk_send_requested_by = p_admin_id,
      sevdesk_send_created_at = now(),
      sevdesk_send_error_code = null,
      updated_at = now()
  where id = p_invoice_id;
  return 'reserved';
end;
$$;

create or replace function public.mark_coach_quarter_stale(
  p_coach_id uuid,
  p_session_date timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_coach_id is null or p_session_date is null then
    return;
  end if;
  update public.coach_quarter_releases
  set release_status = 'stale', updated_at = now()
  where coach_id in (
      p_coach_id,
      (select m.id from public.team_members m where m.user_id = p_coach_id)
    )
    and billing_year = extract(year from p_session_date at time zone 'Europe/Vienna')::integer
    and billing_quarter = (
      floor((extract(month from p_session_date at time zone 'Europe/Vienna')::integer - 1) / 3) + 1
    )
    and release_status = 'released';
end;
$$;

create or replace function public.invalidate_coach_quarter_on_session_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op <> 'INSERT' then
    perform public.mark_coach_quarter_stale(old.therapist_id, old.date);
  end if;
  if tg_op <> 'DELETE' then
    perform public.mark_coach_quarter_stale(new.therapist_id, new.date);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists sessions_coach_quarter_release_invalidation on public.sessions;
create trigger sessions_coach_quarter_release_invalidation
after insert or delete or update of date, price, therapist_id, anfrage_id
on public.sessions
for each row execute function public.invalidate_coach_quarter_on_session_change();

create or replace function public.invalidate_coach_quarter_on_anfrage_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session record;
begin
  for v_session in
    select therapist_id, date
    from public.sessions
    where anfrage_id = new.id
  loop
    perform public.mark_coach_quarter_stale(v_session.therapist_id, v_session.date);
  end loop;
  return new;
end;
$$;

drop trigger if exists anfragen_coach_quarter_release_invalidation on public.anfragen;
create trigger anfragen_coach_quarter_release_invalidation
after update of invoice_with_vat, beschaeftigungsgrad
on public.anfragen
for each row
when (
  old.invoice_with_vat is distinct from new.invoice_with_vat
  or old.beschaeftigungsgrad is distinct from new.beschaeftigungsgrad
)
execute function public.invalidate_coach_quarter_on_anfrage_change();

create or replace function public.invalidate_coach_quarter_on_tax_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.coach_quarter_releases
  set release_status = 'stale', updated_at = now()
  where coach_id = coalesce(new.therapist_id, old.therapist_id)
    and release_status = 'released';
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists therapist_settings_coach_quarter_release_invalidation
  on public.therapist_invoice_settings;
create trigger therapist_settings_coach_quarter_release_invalidation
after insert or update of company_name, address, default_vat_rate, business_country_code, vat_number,
  uid_confirmed_at, uid_confirmed_by or delete
on public.therapist_invoice_settings
for each row execute function public.invalidate_coach_quarter_on_tax_profile_change();

create or replace function public.invalidate_coach_quarter_on_team_member_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.coach_quarter_releases
  set release_status = 'stale', updated_at = now()
  where coach_id = new.id
    and release_status = 'released';
  return new;
end;
$$;

drop trigger if exists team_members_coach_quarter_release_invalidation
  on public.team_members;
create trigger team_members_coach_quarter_release_invalidation
after update of user_id, email, profile_name, name, sevdesk_contact_id, active, role
on public.team_members
for each row
when (
  old.user_id is distinct from new.user_id
  or old.email is distinct from new.email
  or old.profile_name is distinct from new.profile_name
  or old.name is distinct from new.name
  or old.sevdesk_contact_id is distinct from new.sevdesk_contact_id
  or old.active is distinct from new.active
  or old.role is distinct from new.role
)
execute function public.invalidate_coach_quarter_on_team_member_change();

revoke all on function public.coach_quarter_snapshot(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.release_coach_quarter(uuid, integer, integer, uuid) from public, anon, authenticated;
revoke all on function public.reserve_coach_invoice_creation(uuid, uuid, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.mark_coach_quarter_stale(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.invalidate_coach_quarter_on_session_change() from public, anon, authenticated;
revoke all on function public.invalidate_coach_quarter_on_anfrage_change() from public, anon, authenticated;
revoke all on function public.invalidate_coach_quarter_on_tax_profile_change() from public, anon, authenticated;
revoke all on function public.invalidate_coach_quarter_on_team_member_change() from public, anon, authenticated;
grant execute on function public.coach_quarter_snapshot(uuid, integer, integer) to service_role;
grant execute on function public.release_coach_quarter(uuid, integer, integer, uuid) to service_role;
grant execute on function public.reserve_coach_invoice_creation(uuid, uuid, integer, timestamptz) to service_role;

commit;
