-- Prepared only. Do not apply without a separate schema/role and rollout approval.
begin;

alter table public.anfrage_health_data_consents
  add column coach_id uuid,
  add column superseded_at timestamptz;
alter table public.anfragen
  add column care_version bigint not null default 0,
  add column care_episode_id uuid,
  add column admin_coach_selection_version bigint,
  add column meeting_link_care_version bigint not null default 0;
alter table public.request_conversations add column care_episode_id uuid;
alter table public.appointment_proposals add column care_version bigint;

create table public.request_care_assignments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.anfragen(id) on delete restrict,
  coach_id uuid not null references public.team_members(id) on delete restrict,
  observed_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (id, request_id, coach_id)
);
create unique index request_care_assignments_one_current
  on public.request_care_assignments(request_id) where ended_at is null;
create table public.request_care_transfers (
  operation_id uuid primary key,
  request_id uuid not null references public.anfragen(id) on delete restrict,
  actor_id uuid not null references public.team_members(id) on delete restrict,
  from_coach_id uuid,
  to_coach_id uuid,
  reason_code text not null check (reason_code in ('not_match','therapist_change')),
  expected_version bigint not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create table public.request_health_authorizations (
  id uuid primary key default gen_random_uuid(),
  consent_id uuid not null references public.anfrage_health_data_consents(id) on delete restrict,
  request_id uuid references public.anfragen(id) on delete restrict,
  care_episode_id uuid references public.request_care_assignments(id) on delete restrict,
  coach_id uuid not null references public.team_members(id) on delete restrict,
  purpose text not null check (purpose in ('intake', 'messaging')),
  notice_version text not null,
  granted_at timestamptz not null default now()
);
create table public.request_care_operations (
  id uuid primary key,
  request_id uuid not null references public.anfragen(id) on delete restrict,
  care_version bigint not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
-- No historical episode or recipient scope is inferred or backfilled.
alter table public.request_care_assignments enable row level security;
alter table public.request_care_transfers enable row level security;
alter table public.request_health_authorizations enable row level security;
alter table public.request_care_operations enable row level security;
revoke all on public.request_care_assignments, public.request_care_transfers,
  public.request_health_authorizations, public.request_care_operations from public, anon, authenticated;
grant all on public.request_care_assignments, public.request_care_transfers,
  public.request_health_authorizations, public.request_care_operations to service_role;

-- Browser roles must use the purpose-scoped server APIs, not legacy base-table policies.
revoke all on public.anfragen from public, anon, authenticated;
revoke all on public.sessions, public.invoices, public.blocked_slots,
  public.appointment_proposals from public, anon, authenticated;
do $$
declare col record; target_table text;
begin
  foreach target_table in array array['anfragen','sessions','invoices','blocked_slots','appointment_proposals']
  loop
    for col in select c.column_name from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = target_table
    loop
      execute format('revoke select (%I), insert (%I), update (%I), references (%I)
        on public.%I from public, anon, authenticated',
        col.column_name, col.column_name, col.column_name, col.column_name, target_table);
    end loop;
  end loop;
end;
$$;

-- No consent/coach backfill: historical recipients cannot be inferred safely.
create function public.privacy_health_payload(p_request public.anfragen)
returns jsonb language sql immutable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from jsonb_each(to_jsonb(p_request))
  where key = any(array['themen','anliegen','leidensdruck','verlauf','diagnose',
    'ziel','check_suizid','terminwunsch_text']);
$$;

create function public.privacy_consent_allows(
  p_request public.anfragen, p_coach_id uuid default null
)
returns boolean language sql stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.anfrage_health_data_consents c
    where c.request_id = p_request.id and c.revoked_at is null and c.superseded_at is null
      and c.text_version = '2026-10-16-v1'
      and (p_coach_id is null or (
        p_request.assigned_therapist_id = p_coach_id
        and exists (
          select 1 from public.request_health_authorizations h
          join public.request_care_assignments e on e.id = h.care_episode_id
          where h.consent_id = c.id and h.request_id = p_request.id
            and h.coach_id = p_coach_id and h.purpose = 'intake'
            and h.notice_version = '2026-10-28-recipient-v1'
            and h.care_episode_id = p_request.care_episode_id
            and e.request_id = p_request.id and e.coach_id = p_coach_id
            and e.ended_at is null
        )
      ))
  );
$$;

create function public.privacy_read_request_health(p_request_ids uuid[], p_actor_id uuid)
returns jsonb language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  actor public.team_members;
  request public.anfragen;
  result jsonb := '[]'::jsonb;
begin
  select * into actor from public.team_members
    where id = p_actor_id and active = true and role in ('admin','therapist') for share;
  if not found then raise exception 'NO_ACCESS'; end if;
  for request in select * from public.anfragen
    where id = any(p_request_ids) order by id for share
  loop
    if actor.role = 'admin' or request.assigned_therapist_id = actor.id then
      result := result || jsonb_build_array(
        jsonb_build_object('id', request.id, '__healthAllowed',
          public.privacy_consent_allows(request,
            case when actor.role = 'therapist' then actor.id else null end))
        || case when public.privacy_consent_allows(request,
            case when actor.role = 'therapist' then actor.id else null end)
          then public.privacy_health_payload(request) else '{}'::jsonb end);
    end if;
  end loop;
  return result;
end;
$$;

create function public.privacy_read_public_health(
  p_request_id uuid, p_booking_token text, p_consent_hash text
)
returns jsonb language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare request public.anfragen;
begin
  select * into request from public.anfragen
    where id = p_request_id and booking_token::text = p_booking_token for share;
  if not found then return null; end if;
  if not exists (
    select 1 from public.anfrage_health_data_consents
    where request_id = request.id and token_hash = p_consent_hash
      and revoked_at is null and superseded_at is null and text_version = '2026-10-16-v1'
  ) then return null; end if;
  return public.privacy_health_payload(request);
end;
$$;

create function public.privacy_grant_intake_consent(
  p_request_id uuid, p_booking_token text, p_token_hash text
)
returns uuid language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  request public.anfragen;
  consent_id uuid;
begin
  if p_request_id is not null then
    select * into request from public.anfragen
      where id = p_request_id and booking_token::text = p_booking_token for update;
    if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
    update public.anfrage_health_data_consents set superseded_at = now()
      where request_id = request.id and superseded_at is null;
  end if;
  insert into public.anfrage_health_data_consents
    (request_id, token_hash, text_version, coach_id)
  values (p_request_id, p_token_hash, '2026-10-16-v1', null)
  returning id into consent_id;
  return consent_id;
end;
$$;

create function public.privacy_revoke_intake_consent(
  p_request_id uuid, p_booking_token text, p_token_hash text
)
returns boolean language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  consent public.anfrage_health_data_consents;
  linked_id uuid;
begin
  select request_id into linked_id from public.anfrage_health_data_consents
    where token_hash = p_token_hash;
  if not found then return false; end if;
  if linked_id is not null then
    perform 1 from public.anfragen where id = linked_id
      and booking_token::text = p_booking_token for update;
    if not found then return false; end if;
  end if;
  select * into consent from public.anfrage_health_data_consents
    where token_hash = p_token_hash for update;
  -- A concurrently attached unlinked proof requires retry with its booking credential.
  if consent.request_id is distinct from linked_id
    or (p_request_id is not null and p_request_id is distinct from linked_id) then
    return false;
  end if;
  update public.anfrage_health_data_consents set revoked_at = coalesce(revoked_at, now())
    where id = consent.id;
  return true;
end;
$$;

create function public.privacy_save_intake(
  p_request_id uuid, p_booking_token text, p_consent_id uuid,
  p_payload jsonb, p_draft boolean default false
)
returns jsonb language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  request public.anfragen;
  consent public.anfrage_health_data_consents;
  target_id uuid := coalesce(p_request_id, gen_random_uuid());
  payload jsonb := p_payload;
  allowed text[] := array['vorname','nachname','email','telefon','strasse_hausnr',
    'plz_ort','geburtsdatum','beschaeftigungsgrad','coaching_typ','wunschtherapeut',
    'assigned_therapist_id','structured_time_preference','draft_recovery_consent',
    'draft_recovery_consent_at','draft_recovery_consent_version','draft_last_activity_at',
    'draft_current_step','status','match_state','admin_therapeuten'];
  columns_sql text;
  values_sql text;
  set_sql text;
begin
  if not p_draft then
    allowed := allowed || array['anliegen','leidensdruck','verlauf','diagnose','ziel',
      'check_suizid','terminwunsch_text','bevorzugte_zeit','check_datenschutz','check_online_setting'];
  end if;
  if jsonb_typeof(payload) is distinct from 'object' or exists (
    select 1 from jsonb_object_keys(payload) k where not k = any(allowed)
  ) then raise exception 'INVALID_INTAKE_PAYLOAD'; end if;
  if p_request_id is not null then
    select * into request from public.anfragen where id = p_request_id
      and booking_token::text = p_booking_token for update;
    if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
    if p_draft and request.status <> 'draft' then
      raise exception 'REQUEST_ALREADY_FINALIZED';
    end if;
    if (
      request.assigned_therapist_id is distinct from (payload->>'assigned_therapist_id')::uuid
    ) then raise exception 'INTAKE_RECIPIENT_CHANGE_REQUIRES_APPROVAL'; end if;
    if not p_draft and request.status not in
      ('draft','admin_weiterleiten','admin_vorschlaege_gesendet') then
      payload := payload - array['status','match_state','admin_therapeuten','bevorzugte_zeit'];
    end if;
    if request.status <> 'draft' then
      payload := payload - array['wunschtherapeut','admin_therapeuten','bevorzugte_zeit'];
    end if;
  end if;
  select * into consent from public.anfrage_health_data_consents
    where id = p_consent_id for update;
  if not found or consent.revoked_at is not null or consent.superseded_at is not null or
    consent.text_version <> '2026-10-16-v1' or
    (p_request_id is null and consent.request_id is not null) or
    (p_request_id is not null and consent.request_id is distinct from p_request_id)
  then raise exception 'HEALTH_DATA_CONSENT_REQUIRED'; end if;
  if not exists (
    select 1 from public.request_health_authorizations h
    where h.consent_id = consent.id
      and h.coach_id = (payload->>'assigned_therapist_id')::uuid
      and h.purpose = 'intake' and h.notice_version = '2026-10-28-recipient-v1'
      and (h.request_id is null and p_request_id is null or (
        h.request_id = request.id and h.care_episode_id = request.care_episode_id))
  ) then raise exception 'RECIPIENT_CONSENT_REQUIRED'; end if;
  if not exists (select 1 from public.team_members
    where id = (payload->>'assigned_therapist_id')::uuid and active = true
      and role = 'therapist') then raise exception 'INVALID_COACH'; end if;
  if p_request_id is null then
    payload := payload || jsonb_build_object('id', target_id, 'booking_token', gen_random_uuid());
  end if;
  select string_agg(format('%I', k), ','),
    string_agg(format('incoming.%I', k), ','),
    string_agg(format('%I = incoming.%I', k, k), ',')
  into columns_sql, values_sql, set_sql from jsonb_object_keys(payload) k;
  if p_request_id is null then
    execute format('insert into public.anfragen (%s) select %s from
      jsonb_populate_record(null::public.anfragen, $1) incoming', columns_sql, values_sql)
      using payload;
    update public.anfrage_health_data_consents
      set request_id = target_id
      where id = consent.id;
    update public.request_health_authorizations
      set request_id = target_id,
        care_episode_id = (select care_episode_id from public.anfragen where id = target_id)
      where consent_id = consent.id and request_id is null
        and coach_id = (payload->>'assigned_therapist_id')::uuid;
  else
    execute format('update public.anfragen set %s from
      jsonb_populate_record(null::public.anfragen, $1) incoming where anfragen.id = $2', set_sql)
      using payload, target_id;
  end if;
  select * into request from public.anfragen where id = target_id;
  return jsonb_build_object('id', request.id, 'booking_token', request.booking_token,
    'assigned_therapist_id', request.assigned_therapist_id, 'care_version', request.care_version);
end;
$$;

create function public.privacy_assignment_guard()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $$
begin
  if new.assigned_therapist_id is distinct from old.assigned_therapist_id
    and current_setting('privacy.transfer_request', true) is distinct from old.id::text then
    raise exception 'ATOMIC_CARE_TRANSFER_REQUIRED';
  end if;
  if (new.care_version is distinct from old.care_version
      or new.care_episode_id is distinct from old.care_episode_id)
    and current_setting('privacy.transfer_request', true) is distinct from old.id::text then
    raise exception 'ATOMIC_CARE_TRANSFER_REQUIRED';
  end if;
  if old.assigned_therapist_id is distinct from new.assigned_therapist_id then
    update public.request_conversations
      set status = 'closed', closed_at = now(), alias_revoked_at = now(),
        close_reason = 'assignment_changed'
      where anfrage_id = old.id and status = 'open';
  end if;
  return new;
end;
$$;
create trigger privacy_assignment_guard
  before update of assigned_therapist_id, care_version, care_episode_id on public.anfragen
  for each row execute function public.privacy_assignment_guard();

create function public.privacy_initialize_care()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare episode_id uuid;
begin
  if new.assigned_therapist_id is not null then
    insert into public.request_care_assignments(request_id, coach_id)
      values(new.id, new.assigned_therapist_id) returning id into episode_id;
    perform set_config('privacy.transfer_request', new.id::text, true);
    update public.anfragen set care_episode_id = episode_id where id = new.id;
    perform set_config('privacy.transfer_request', '', true);
  end if;
  return new;
end;
$$;
create trigger privacy_initialize_care after insert on public.anfragen
  for each row execute function public.privacy_initialize_care();

create function public.privacy_check_transfer_conflicts(p_request public.anfragen)
returns void language plpgsql security invoker
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.request_care_operations
    where request_id = p_request.id and completed_at is null) then
    raise exception 'CARE_OPERATION_IN_PROGRESS';
  end if;
  if exists (select 1 from public.sessions s where s.anfrage_id = p_request.id
      and s.date::timestamptz
        + greatest(coalesce(s.duration_min, 60), 1) * interval '1 minute' > now())
    or exists (select 1 from public.blocked_slots b
      where b.anfrage_id = p_request.id and b.end_at > now())
    or exists (select 1 from public.appointment_proposals p
      where p.anfrage_id = p_request.id and p.date::timestamptz > now()
        and (p.expires_at is null or p.expires_at > now()))
    or (p_request.bevorzugte_zeit is not null
      and p_request.bevorzugte_zeit::timestamptz + interval '1 hour' > now()) then
    raise exception 'FUTURE_APPOINTMENTS_REQUIRE_DECISION';
  end if;
end;
$$;

create function public.privacy_authorize_recipient(
  p_request_id uuid, p_booking_token text, p_consent_hash text,
  p_coach_id uuid, p_expected_version bigint, p_notice_version text
)
returns boolean language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  request public.anfragen;
  consent public.anfrage_health_data_consents;
  episode_id uuid;
  selection_change boolean;
begin
  if p_notice_version is distinct from '2026-10-28-recipient-v1' then
    raise exception 'INVALID_RECIPIENT_NOTICE';
  end if;
  if not exists (select 1 from public.team_members where id = p_coach_id
    and active = true and role = 'therapist') then raise exception 'INVALID_COACH'; end if;
  if p_request_id is not null then
    select * into request from public.anfragen where id = p_request_id
      and booking_token::text = p_booking_token for update;
    if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
    if p_expected_version is null or request.care_version <> p_expected_version then
      raise exception 'CARE_VERSION_CONFLICT';
    end if;
  end if;
  select * into consent from public.anfrage_health_data_consents
    where token_hash = p_consent_hash for update;
  if not found or consent.request_id is distinct from p_request_id
    or consent.revoked_at is not null or consent.superseded_at is not null
    or consent.text_version <> '2026-10-16-v1' then
    raise exception 'HEALTH_DATA_CONSENT_REQUIRED';
  end if;
  if p_request_id is not null then
    selection_change := request.assigned_therapist_id is distinct from p_coach_id;
    if selection_change and request.status = 'draft' then
      if not exists (select 1 from public.team_members where id = p_coach_id
        and active = true and available_for_intake = true and role = 'therapist')
      then raise exception 'COACH_NOT_APPROVED'; end if;
      perform public.privacy_check_transfer_conflicts(request);
    elsif request.assigned_therapist_id is null then
      if request.admin_coach_selection_version is distinct from request.care_version
        or not coalesce(to_jsonb(request.admin_therapeuten) @> jsonb_build_array(p_coach_id::text), false)
      then raise exception 'COACH_NOT_APPROVED'; end if;
      perform public.privacy_check_transfer_conflicts(request);
    elsif request.assigned_therapist_id <> p_coach_id then
      raise exception 'INTAKE_RECIPIENT_CHANGE_REQUIRES_APPROVAL';
    end if;
    episode_id := case when selection_change then null else request.care_episode_id end;
    if episode_id is null then
      update public.request_care_assignments set ended_at = now()
        where request_id = request.id and ended_at is null;
      insert into public.request_care_assignments(request_id, coach_id)
        values(request.id, p_coach_id) returning id into episode_id;
      perform set_config('privacy.transfer_request', request.id::text, true);
      update public.anfragen set assigned_therapist_id = p_coach_id,
        care_episode_id = episode_id,
        care_version = care_version + case when selection_change then 1 else 0 end
        where id = request.id;
      perform set_config('privacy.transfer_request', '', true);
    end if;
  end if;
  insert into public.request_health_authorizations
    (consent_id, request_id, care_episode_id, coach_id, purpose, notice_version)
    values(consent.id, p_request_id, episode_id, p_coach_id, 'intake', p_notice_version);
  return true;
end;
$$;

create function public.privacy_handover_request(
  p_request_id uuid, p_actor_id uuid, p_handover_type text,
  p_target_coach_id uuid, p_expected_version bigint, p_operation_id uuid
)
returns jsonb language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  request public.anfragen;
  actor public.team_members;
  previous public.request_care_transfers;
  episode_id uuid;
  result jsonb;
begin
  if p_handover_type not in ('not_match','therapist_change') then
    raise exception 'INVALID_HANDOVER_TYPE';
  end if;
  select * into actor from public.team_members
    where id = p_actor_id and active = true and role in ('admin','therapist') for share;
  if not found then raise exception 'NO_ACCESS'; end if;
  select * into request from public.anfragen where id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if p_operation_id is null or p_expected_version is null then
    raise exception 'TRANSFER_PRECONDITION_REQUIRED';
  end if;
  select * into previous from public.request_care_transfers where operation_id = p_operation_id;
  if found then
    if previous.request_id <> request.id or previous.actor_id <> actor.id
      or previous.to_coach_id is distinct from p_target_coach_id
      or previous.reason_code <> p_handover_type
      or previous.expected_version <> p_expected_version then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return previous.result;
  end if;
  if actor.role = 'therapist' and actor.id is distinct from request.assigned_therapist_id then
    raise exception 'NO_ACCESS';
  end if;
  if request.care_version <> p_expected_version then raise exception 'CARE_VERSION_CONFLICT'; end if;
  if actor.role <> 'admin' and p_target_coach_id is not null then raise exception 'NO_ACCESS'; end if;
  if p_target_coach_id is not null and not exists (
    select 1 from public.team_members where id = p_target_coach_id and active = true
      and role = 'therapist'
  ) then raise exception 'INVALID_COACH'; end if;
  if p_target_coach_id is not distinct from request.assigned_therapist_id then
    raise exception 'COACH_UNCHANGED';
  end if;
  perform public.privacy_check_transfer_conflicts(request);
  update public.request_care_assignments set ended_at = now()
    where request_id = request.id and ended_at is null;
  if p_target_coach_id is not null then
    insert into public.request_care_assignments(request_id, coach_id)
      values (request.id, p_target_coach_id) returning id into episode_id;
  end if;
  perform set_config('privacy.transfer_request', request.id::text, true);
  update public.anfragen a set
    status = case when p_target_coach_id is null then 'admin_weiterleiten' else a.status end,
    assigned_therapist_id = p_target_coach_id,
    care_episode_id = episode_id, care_version = care_version + 1
    where a.id = request.id;
  perform set_config('privacy.transfer_request', '', true);
  result := jsonb_build_object('ok', true, 'mode', 'existing', 'requestId', request.id,
    'careVersion', request.care_version + 1, 'sensitiveDataAccessRequired', true,
    'conversationPendingConsent', true);
  insert into public.request_care_transfers(operation_id, request_id, actor_id,
    from_coach_id, to_coach_id, reason_code, expected_version, result)
    values(p_operation_id, request.id, actor.id, request.assigned_therapist_id,
      p_target_coach_id, p_handover_type, p_expected_version, result);
  return result;
end;
$$;

create function public.privacy_messaging_context(
  p_request_id uuid default null, p_conversation_id uuid default null,
  p_reply_hash text default null, p_coach_id uuid default null
)
returns jsonb language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  request public.anfragen;
  conversation public.request_conversations;
  request_id uuid := p_request_id;
begin
  if p_conversation_id is not null or p_reply_hash is not null then
    select * into conversation from public.request_conversations
      where (p_conversation_id is null or id = p_conversation_id)
        and (p_reply_hash is null or reply_token_hash = p_reply_hash);
    if not found then return '{"allowed":false}'::jsonb; end if;
    request_id := conversation.anfrage_id;
  end if;
  select * into request from public.anfragen where id = request_id for share;
  if not found or request.status in ('beendet','papierkorb','kein_match','abgelehnt')
    or request.assigned_therapist_id is null
    or not public.privacy_consent_allows(request, request.assigned_therapist_id)
    or (p_coach_id is not null and p_coach_id <> request.assigned_therapist_id)
    or not exists (select 1 from public.team_members
      where id = request.assigned_therapist_id and active = true and role = 'therapist')
  then return '{"allowed":false}'::jsonb; end if;
  if not exists (
    select 1 from public.request_health_authorizations h
    join public.anfrage_health_data_consents c on c.id = h.consent_id
    where h.request_id = request.id and h.care_episode_id = request.care_episode_id
      and h.coach_id = request.assigned_therapist_id and h.purpose = 'messaging'
      and c.request_id = request.id and c.revoked_at is null and c.superseded_at is null
      and false -- A separate communication scope and dispatch boundary are not yet approved.
  ) then return '{"allowed":false,"reason":"MESSAGING_CONTENT_PAUSED"}'::jsonb; end if;
  if conversation.id is not null then
    -- Reload after locking the request to observe a concurrently closed conversation.
    select * into conversation from public.request_conversations where id = conversation.id;
    if conversation.status <> 'open' or conversation.alias_revoked_at is not null
      or conversation.therapist_id <> request.assigned_therapist_id
      or conversation.care_episode_id is distinct from request.care_episode_id
    then return '{"allowed":false}'::jsonb; end if;
  end if;
  return jsonb_build_object('allowed', true, 'requestId', request.id,
    'conversationId', conversation.id, 'careVersion', request.care_version);
end;
$$;

create function public.privacy_message_write_guard()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $$
begin
  if not coalesce((public.privacy_messaging_context(
    p_conversation_id => new.conversation_id)->>'allowed')::boolean, false) then
    raise exception 'MESSAGE_PROCESSING_NOT_AUTHORIZED';
  end if;
  return new;
end;
$$;
create trigger privacy_message_write_guard
  before insert or update of text_body, html_body, subject on public.request_messages
  for each row execute function public.privacy_message_write_guard();

create function public.privacy_read_messages(p_conversation_id uuid, p_coach_id uuid)
returns jsonb language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare context jsonb;
begin
  context := public.privacy_messaging_context(
    p_conversation_id => p_conversation_id, p_coach_id => p_coach_id);
  if not (context->>'allowed')::boolean then return null; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', id, 'direction', direction, 'sender_role', sender_role, 'subject', subject,
    'text_body', text_body, 'delivery_status', delivery_status, 'created_at', created_at)
    order by created_at) from public.request_messages
    where conversation_id = p_conversation_id), '[]'::jsonb);
end;
$$;

create function public.privacy_coach_can_read(p_conversation_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.request_conversations c
    join public.anfragen a on a.id = c.anfrage_id
    join public.team_members m on m.id = c.therapist_id
    where c.id = p_conversation_id and c.status = 'open' and c.alias_revoked_at is null
      and m.user_id = auth.uid() and m.role = 'therapist' and m.active = true
      and a.assigned_therapist_id = m.id
      and c.care_episode_id = a.care_episode_id
      and a.status not in ('beendet','papierkorb','kein_match','abgelehnt')
      and public.privacy_consent_allows(a, m.id)
      and exists (select 1 from public.request_health_authorizations h
        join public.anfrage_health_data_consents proof on proof.id = h.consent_id
        where h.request_id = a.id and h.care_episode_id = a.care_episode_id
          and h.coach_id = m.id and h.purpose = 'messaging'
          and false -- No intake proof implicitly authorizes message content.
          and proof.revoked_at is null and proof.superseded_at is null
          and proof.request_id = a.id)
  );
$$;

drop policy "coaches read own request conversations" on public.request_conversations;
drop policy "coaches read own request messages" on public.request_messages;
create policy "coaches read current authorized conversations" on public.request_conversations
  for select to authenticated using (public.privacy_coach_can_read(id));
create policy "coaches read current authorized messages" on public.request_messages
  for select to authenticated using (public.privacy_coach_can_read(conversation_id));
revoke all on public.request_message_events from public, anon, authenticated;

create function public.privacy_conversation_guard()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare request public.anfragen;
begin
  if new.status <> 'open' then return new; end if;
  select * into request from public.anfragen where id = new.anfrage_id for update;
  if not found or new.therapist_id is distinct from request.assigned_therapist_id
    or not coalesce((public.privacy_messaging_context(p_request_id => new.anfrage_id,
      p_coach_id => new.therapist_id)->>'allowed')::boolean, false) then
    raise exception 'MESSAGE_PROCESSING_NOT_AUTHORIZED';
  end if;
  if tg_op = 'UPDATE' and (old.status <> 'open'
    or old.care_episode_id is distinct from request.care_episode_id) then
    raise exception 'CLOSED_CONVERSATION_CANNOT_REOPEN';
  end if;
  new.care_episode_id := request.care_episode_id;
  return new;
end;
$$;
create trigger privacy_conversation_guard before insert or update on public.request_conversations
  for each row execute function public.privacy_conversation_guard();

create function public.privacy_appointment_context(
  p_request_id uuid, p_expected_coach_id uuid default null,
  p_expected_care_version bigint default null
)
returns jsonb language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare request public.anfragen;
begin
  select * into request from public.anfragen where id = p_request_id for share;
  if not found or request.assigned_therapist_id is null
    or request.status in ('beendet','papierkorb','kein_match','abgelehnt')
    or (p_expected_coach_id is not null and
      request.assigned_therapist_id <> p_expected_coach_id)
    or (p_expected_care_version is not null and request.care_version <> p_expected_care_version)
  then return '{"allowed":false}'::jsonb; end if;
  return jsonb_build_object('allowed', true, 'coachId', request.assigned_therapist_id,
    'careVersion', request.care_version);
end;
$$;

create function public.privacy_begin_appointment_operation(
  p_request_id uuid, p_expected_coach_id uuid, p_expected_version bigint,
  p_operation_id uuid
)
returns jsonb language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare context jsonb;
begin
  perform 1 from public.anfragen where id = p_request_id for update;
  context := public.privacy_appointment_context(p_request_id, p_expected_coach_id,
    p_expected_version);
  if not coalesce((context->>'allowed')::boolean, false)
    or p_operation_id is null or p_expected_version is null then
    raise exception 'CARE_VERSION_CONFLICT';
  end if;
  insert into public.request_care_operations(id, request_id, care_version)
    values(p_operation_id, p_request_id, p_expected_version);
  return context || jsonb_build_object('operationId', p_operation_id);
end;
$$;
create function public.privacy_end_appointment_operation(p_operation_id uuid)
returns jsonb language plpgsql security invoker
set search_path = public, pg_temp
as $$
begin
  update public.request_care_operations set completed_at = now()
    where id = p_operation_id and completed_at is null;
  return jsonb_build_object('allowed', found, 'operationId', p_operation_id);
end;
$$;

create function public.privacy_care_child_guard()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare request public.anfragen;
begin
  if new.anfrage_id is null then return new; end if;
  select * into request from public.anfragen where id = new.anfrage_id for update;
  if not found or new.therapist_id::text is distinct from request.assigned_therapist_id::text then
    raise exception 'CARE_VERSION_CONFLICT';
  end if;
  if tg_table_name = 'appointment_proposals' then
    new := jsonb_populate_record(new,
      jsonb_build_object('care_version', request.care_version));
  end if;
  return new;
end;
$$;
create trigger privacy_session_care_guard before insert on public.sessions
  for each row execute function public.privacy_care_child_guard();
create trigger privacy_slot_care_guard before insert on public.blocked_slots
  for each row execute function public.privacy_care_child_guard();
create trigger privacy_proposal_care_guard before insert on public.appointment_proposals
  for each row execute function public.privacy_care_child_guard();

create function public.privacy_save_client_invoice(
  p_actor_id uuid, p_invoice_id uuid, p_request_id uuid,
  p_expected_version bigint, p_payload jsonb
)
returns jsonb language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  actor public.team_members;
  request public.anfragen;
  invoice public.invoices;
  owner_id uuid;
  allowed text[] := array[
    'invoice_number','invoice_date','service_period','customer_number','contact_person',
    'client_name','client_street','client_city','client_country','client_email',
    'salutation','intro_text','payment_terms','closing_text',
    'vat_rate','total_net','vat_amount','total_gross','line_items',
    'anfrage_id','therapist_id','updated_at'];
  columns_sql text;
  values_sql text;
  set_sql text;
begin
  select * into request from public.anfragen where id = p_request_id for update;
  if not found then raise exception 'ANFRAGE_NOT_FOUND'; end if;
  select * into actor from public.team_members where user_id = p_actor_id
    and active = true and role in ('admin','therapist') for share;
  if not found then raise exception 'NO_ACCESS'; end if;
  if p_expected_version is null or p_expected_version <> request.care_version then
    raise exception 'CARE_VERSION_CONFLICT';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or exists (
    select 1 from jsonb_object_keys(p_payload) key where not key = any(allowed)
  ) then raise exception 'INVALID_INVOICE_PAYLOAD'; end if;
  if p_invoice_id is not null then
    select * into invoice from public.invoices where id = p_invoice_id for update;
    if not found or invoice.anfrage_id is distinct from request.id then
      raise exception 'INVOICE_NOT_FOUND';
    end if;
    owner_id := invoice.therapist_id;
  else
    owner_id := request.assigned_therapist_id;
  end if;
  if owner_id is null or (p_payload->>'therapist_id')::uuid is distinct from owner_id
    or (p_payload->>'anfrage_id')::uuid is distinct from request.id then
    raise exception 'INVOICE_OWNER_MISMATCH';
  end if;
  if actor.role = 'therapist' and (
    request.assigned_therapist_id is distinct from actor.id
    or not coalesce(owner_id in (actor.id, actor.user_id), false)
  ) then raise exception 'NO_ACCESS'; end if;
  if p_payload ? 'line_items' then
    if jsonb_typeof(p_payload->'line_items') <> 'array' then
      raise exception 'INVALID_INVOICE_PAYLOAD';
    end if;
    -- Lock referenced sessions after the request so reassignment cannot race line validation.
    perform s.id from public.sessions s
      where s.id in (select (line->>'session_id')::uuid
        from jsonb_array_elements(p_payload->'line_items') line
        where nullif(line->>'session_id', '') is not null)
      order by s.id for share;
    if exists (
      select 1 from jsonb_array_elements(p_payload->'line_items') line
      where nullif(line->>'session_id', '') is not null and not exists (
        select 1 from public.sessions s
        join public.team_members owner on owner.id = owner_id or owner.user_id = owner_id
        where s.id = (line->>'session_id')::uuid and s.anfrage_id = request.id
          and s.therapist_id::text in (owner.id::text, owner.user_id::text)
      )
    ) then raise exception 'INVALID_INVOICE_SESSIONS'; end if;
  end if;
  select string_agg(format('%I', key), ','),
    string_agg(format('incoming.%I', key), ','),
    string_agg(format('%I = incoming.%I', key, key), ',')
    into columns_sql, values_sql, set_sql from jsonb_object_keys(p_payload) key;
  if p_invoice_id is null then
    execute format('insert into public.invoices (%s) select %s from
      jsonb_populate_record(null::public.invoices, $1) incoming returning to_jsonb(invoices)',
      columns_sql, values_sql) into p_payload using p_payload;
  else
    execute format('update public.invoices set %s from
      jsonb_populate_record(null::public.invoices, $1) incoming
      where invoices.id = $2 returning to_jsonb(invoices)', set_sql)
      into p_payload using p_payload, p_invoice_id;
  end if;
  return p_payload;
end;
$$;

create function public.privacy_delete_care_session(p_actor_id uuid, p_session_id uuid)
returns jsonb language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  actor public.team_members;
  session public.sessions;
  request public.anfragen;
  request_id uuid;
begin
  select anfrage_id into request_id from public.sessions where id = p_session_id;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  select * into request from public.anfragen where id = request_id for update;
  if not found then raise exception 'ANFRAGE_NOT_FOUND'; end if;
  select * into actor from public.team_members where user_id = p_actor_id
    and active = true and role in ('admin','therapist') for share;
  if not found then raise exception 'NO_ACCESS'; end if;
  select * into session from public.sessions where id = p_session_id for update;
  if not found or session.anfrage_id is distinct from request.id then
    raise exception 'SESSION_NOT_FOUND';
  end if;
  if actor.role = 'therapist' and (
    request.assigned_therapist_id is distinct from actor.id
    or not coalesce(session.therapist_id::text in (actor.id::text, actor.user_id::text), false)
  ) then raise exception 'NO_ACCESS'; end if;
  delete from public.sessions where id = session.id;
  return '{"success":true}'::jsonb;
end;
$$;

-- Restrict all new RPCs to trusted server code; only the identity-bound RLS helper is public to staff.
revoke all on function public.privacy_health_payload(public.anfragen) from public, anon, authenticated;
revoke all on function public.privacy_consent_allows(public.anfragen, uuid) from public, anon, authenticated;
revoke all on function public.privacy_read_request_health(uuid[], uuid) from public, anon, authenticated;
revoke all on function public.privacy_read_public_health(uuid, text, text) from public, anon, authenticated;
revoke all on function public.privacy_grant_intake_consent(uuid, text, text) from public, anon, authenticated;
revoke all on function public.privacy_revoke_intake_consent(uuid, text, text) from public, anon, authenticated;
revoke all on function public.privacy_save_intake(uuid, text, uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.privacy_assignment_guard() from public, anon, authenticated;
revoke all on function public.privacy_handover_request(uuid, uuid, text, uuid, bigint, uuid) from public, anon, authenticated;
revoke all on function public.privacy_messaging_context(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.privacy_message_write_guard() from public, anon, authenticated;
revoke all on function public.privacy_read_messages(uuid, uuid) from public, anon, authenticated;
revoke all on function public.privacy_coach_can_read(uuid) from public, anon, authenticated;
grant execute on function public.privacy_health_payload(public.anfragen),
  public.privacy_consent_allows(public.anfragen, uuid),
  public.privacy_read_request_health(uuid[], uuid),
  public.privacy_read_public_health(uuid, text, text),
  public.privacy_grant_intake_consent(uuid, text, text),
  public.privacy_revoke_intake_consent(uuid, text, text),
  public.privacy_save_intake(uuid, text, uuid, jsonb, boolean),
  public.privacy_assignment_guard(),
  public.privacy_handover_request(uuid, uuid, text, uuid, bigint, uuid),
  public.privacy_messaging_context(uuid, uuid, text, uuid),
  public.privacy_message_write_guard(),
  public.privacy_read_messages(uuid, uuid) to service_role;
grant execute on function public.privacy_coach_can_read(uuid) to authenticated;

revoke all on function public.privacy_initialize_care(),
  public.privacy_check_transfer_conflicts(public.anfragen),
  public.privacy_authorize_recipient(uuid, text, text, uuid, bigint, text),
  public.privacy_conversation_guard(),
  public.privacy_appointment_context(uuid, uuid, bigint),
  public.privacy_begin_appointment_operation(uuid, uuid, bigint, uuid),
  public.privacy_end_appointment_operation(uuid),
  public.privacy_care_child_guard(),
  public.privacy_save_client_invoice(uuid, uuid, uuid, bigint, jsonb),
  public.privacy_delete_care_session(uuid, uuid) from public, anon, authenticated;
grant execute on function public.privacy_initialize_care(),
  public.privacy_check_transfer_conflicts(public.anfragen),
  public.privacy_authorize_recipient(uuid, text, text, uuid, bigint, text),
  public.privacy_conversation_guard(),
  public.privacy_appointment_context(uuid, uuid, bigint),
  public.privacy_begin_appointment_operation(uuid, uuid, bigint, uuid),
  public.privacy_end_appointment_operation(uuid),
  public.privacy_care_child_guard(),
  public.privacy_save_client_invoice(uuid, uuid, uuid, bigint, jsonb),
  public.privacy_delete_care_session(uuid, uuid) to service_role;

commit;
