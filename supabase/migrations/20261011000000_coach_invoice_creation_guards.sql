begin;

do $$
begin
  if exists (
    select 1
    from public.coach_invoices
    where billing_mode = 'quartal'
      and billing_year is not null
      and billing_quarter is not null
      and bundle_key is not null
    group by coach_id, billing_year, billing_quarter, bundle_key
    having count(*) > 1
  ) then
    raise exception
      'Duplicate quarterly coach invoices exist; reconcile them before applying coach invoice creation guards';
  end if;
end;
$$;

create unique index if not exists coach_invoices_quarter_bundle_unique_idx
  on public.coach_invoices (coach_id, billing_year, billing_quarter, bundle_key)
  where billing_mode = 'quartal'
    and billing_year is not null
    and billing_quarter is not null
    and bundle_key is not null;

create or replace function public.lock_coach_billing(p_coach_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coach_id uuid;
begin
  select coalesce(
    (select m.id from public.team_members m where m.id = p_coach_id),
    (select m.id from public.team_members m where m.user_id = p_coach_id),
    p_coach_id
  ) into v_coach_id;

  perform pg_advisory_xact_lock(
    hashtextextended(v_coach_id::text, 752941)
  );
  return v_coach_id;
end;
$$;

create or replace function public.guard_coach_billing_write(p_coach_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coach_id uuid;
begin
  if p_coach_id is null then
    return;
  end if;

  v_coach_id := public.lock_coach_billing(p_coach_id);
  if exists (
    select 1
    from public.coach_invoices i
    where i.coach_id = v_coach_id
      and i.sevdesk_send_status = 'creating'
  ) then
    raise exception 'coach_invoice_creation_in_progress'
      using errcode = '55000';
  end if;
end;
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

  perform public.guard_coach_billing_write(p_coach_id);
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

  perform public.lock_coach_billing(v_invoice.coach_id);

  if exists (
    select 1
    from public.coach_invoices i
    where i.coach_id = v_invoice.coach_id
      and i.billing_mode = v_invoice.billing_mode
      and i.billing_year = v_invoice.billing_year
      and i.billing_quarter = v_invoice.billing_quarter
      and i.bundle_key = v_invoice.bundle_key
      and i.id <> v_invoice.id
  ) then
    return 'duplicate';
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

create or replace function public.guard_coach_billing_source_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coach record;
begin
  if tg_table_name = 'coach_quarter_releases' then
    if tg_op <> 'INSERT' then
      perform public.guard_coach_billing_write(old.coach_id);
    end if;
    if tg_op <> 'DELETE'
      and (tg_op = 'INSERT' or old.coach_id is distinct from new.coach_id) then
      perform public.guard_coach_billing_write(new.coach_id);
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_table_name = 'sessions' then
    for v_coach in
      select distinct affected.therapist_id
      from (
        select old.therapist_id
        where tg_op <> 'INSERT'
        union all
        select new.therapist_id
        where tg_op <> 'DELETE'
      ) affected
      where affected.therapist_id is not null
      order by affected.therapist_id
    loop
      perform public.guard_coach_billing_write(v_coach.therapist_id);
    end loop;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_table_name = 'anfragen' then
    if tg_op = 'UPDATE'
      and (old.invoice_with_vat is distinct from new.invoice_with_vat
        or old.beschaeftigungsgrad is distinct from new.beschaeftigungsgrad) then
      for v_coach in
        select distinct s.therapist_id
        from public.sessions s
        where s.anfrage_id = new.id
          and s.therapist_id is not null
        order by s.therapist_id
      loop
        perform public.guard_coach_billing_write(v_coach.therapist_id);
      end loop;
    end if;
    return new;
  end if;

  if tg_table_name = 'therapist_invoice_settings' then
    for v_coach in
      select distinct affected.therapist_id
      from (
        select old.therapist_id
        where tg_op <> 'INSERT'
        union all
        select new.therapist_id
        where tg_op <> 'DELETE'
      ) affected
      where affected.therapist_id is not null
      order by affected.therapist_id
    loop
      perform public.guard_coach_billing_write(v_coach.therapist_id);
    end loop;
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_table_name = 'team_members' then
    perform public.guard_coach_billing_write(old.id);
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists sessions_coach_billing_creation_guard on public.sessions;
create trigger sessions_coach_billing_creation_guard
before insert or delete or update of date, price, therapist_id, anfrage_id
on public.sessions
for each row execute function public.guard_coach_billing_source_change();

drop trigger if exists anfragen_coach_billing_creation_guard on public.anfragen;
create trigger anfragen_coach_billing_creation_guard
before update of invoice_with_vat, beschaeftigungsgrad
on public.anfragen
for each row execute function public.guard_coach_billing_source_change();

drop trigger if exists coach_quarter_releases_billing_creation_guard
  on public.coach_quarter_releases;
create trigger coach_quarter_releases_billing_creation_guard
before insert or update or delete
on public.coach_quarter_releases
for each row execute function public.guard_coach_billing_source_change();

drop trigger if exists therapist_settings_coach_billing_creation_guard
  on public.therapist_invoice_settings;
create trigger therapist_settings_coach_billing_creation_guard
before insert or update or delete
on public.therapist_invoice_settings
for each row execute function public.guard_coach_billing_source_change();

drop trigger if exists team_members_coach_billing_creation_guard on public.team_members;
create trigger team_members_coach_billing_creation_guard
before update of user_id, email, profile_name, name, sevdesk_contact_id, active, role
  or delete
on public.team_members
for each row execute function public.guard_coach_billing_source_change();

create or replace function public.guard_coach_invoice_creation_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.sevdesk_send_status in ('creating', 'creation_unknown', 'created')
      or old.sevdesk_invoice_id is not null then
      raise exception 'coach_invoice_workflow_record_is_protected'
        using errcode = '55000';
    end if;
    return old;
  end if;

  if old.sevdesk_send_status = 'creating' then
    if (to_jsonb(new) - array[
      'sevdesk_send_status',
      'sevdesk_invoice_id',
      'sevdesk_draft_invoice_number',
      'sevdesk_send_error_code',
      'sevdesk_send_accepted_at',
      'sevdesk_send_email_id',
      'updated_at'
    ]) is distinct from
      (to_jsonb(old) - array[
        'sevdesk_send_status',
        'sevdesk_invoice_id',
        'sevdesk_draft_invoice_number',
        'sevdesk_send_error_code',
        'sevdesk_send_accepted_at',
        'sevdesk_send_email_id',
        'updated_at'
      ]) then
      raise exception 'coach_invoice_creation_in_progress'
        using errcode = '55000';
    end if;

    if new.sevdesk_send_status not in ('created', 'creation_unknown')
      and new.sevdesk_send_status is not null then
      raise exception 'invalid_coach_invoice_creation_transition'
        using errcode = '55000';
    end if;
    if new.sevdesk_send_status = 'created'
      and new.sevdesk_invoice_id is null then
      raise exception 'created_coach_invoice_requires_sevdesk_id'
        using errcode = '55000';
    end if;
    if new.sevdesk_send_status is null
      and new.sevdesk_invoice_id is not null then
      raise exception 'rejected_coach_invoice_cannot_have_sevdesk_id'
        using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists coach_invoice_creation_write_guard on public.coach_invoices;
create trigger coach_invoice_creation_write_guard
before update or delete on public.coach_invoices
for each row execute function public.guard_coach_invoice_creation_update();

create or replace function public.mark_coach_quarter_stale(
  p_coach_id uuid,
  p_session_date timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coach_id uuid;
begin
  if p_coach_id is null or p_session_date is null then
    return;
  end if;

  v_coach_id := public.lock_coach_billing(p_coach_id);
  if exists (
    select 1 from public.coach_invoices i
    where i.coach_id = v_coach_id
      and i.sevdesk_send_status = 'creating'
  ) then
    raise exception 'coach_invoice_creation_in_progress'
      using errcode = '55000';
  end if;

  update public.coach_quarter_releases
  set release_status = 'stale', updated_at = now()
  where coach_id in (
      v_coach_id,
      (select m.user_id from public.team_members m where m.id = v_coach_id)
    )
    and billing_year = extract(year from p_session_date at time zone 'Europe/Vienna')::integer
    and billing_quarter = (
      floor((extract(month from p_session_date at time zone 'Europe/Vienna')::integer - 1) / 3) + 1
    )
    and release_status = 'released';
end;
$$;

revoke all on function public.lock_coach_billing(uuid) from public, anon, authenticated;
revoke all on function public.guard_coach_billing_write(uuid) from public, anon, authenticated;
revoke all on function public.guard_coach_billing_source_change() from public, anon, authenticated;
revoke all on function public.guard_coach_invoice_creation_update() from public, anon, authenticated;
grant execute on function public.lock_coach_billing(uuid) to service_role;
grant execute on function public.guard_coach_billing_write(uuid) to service_role;

commit;
