-- Prepared only. Requires the P0 access migration and reviewed production schema.
begin;

create function public.privacy_lock_recovery_queue_request()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  request_id uuid;
  request_exists boolean;
begin
  begin
    request_id := nullif(trim(new.request_id), '')::uuid;
  exception when invalid_text_representation then
    raise exception 'INVALID_REQUEST_ID';
  end;
  if request_id is null then
    if new.request_id is not null then raise exception 'INVALID_REQUEST_ID'; end if;
    return new;
  end if;
  perform 1 from public.anfragen where id = request_id for key share;
  request_exists := found;
  if not request_exists then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  return new;
end;
$$;
create trigger privacy_lock_recovery_queue_request
  before insert or update of request_id on public.client_link_recovery_queue
  for each row execute function public.privacy_lock_recovery_queue_request();

create function public.privacy_delete_request(p_request_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  actor public.team_members;
  request public.anfragen;
  blockers text[] := array[]::text[];
begin
  select * into actor
  from public.team_members
  where id = p_actor_id and active = true and role = 'admin'
  for share;
  if not found then raise exception 'NO_ACCESS'; end if;

  select * into request
  from public.anfragen
  where id = p_request_id
  for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;

  -- Retained or externally meaningful records are never implicitly purged.
  if exists (select 1 from public.anfrage_health_data_consents c
    where c.request_id = request.id) then
    blockers := array_append(blockers, 'HEALTH_CONSENT_RETENTION');
  end if;
  if exists (select 1 from public.request_care_assignments a
    where a.request_id = request.id)
    or exists (select 1 from public.request_care_transfers t
      where t.request_id = request.id)
    or exists (select 1 from public.request_health_authorizations h
      where h.request_id = request.id or h.care_episode_id in (
        select a.id from public.request_care_assignments a where a.request_id = request.id))
  then
    blockers := array_append(blockers, 'CARE_HISTORY_RETENTION');
  end if;
  if exists (select 1 from public.request_care_operations o
    where o.request_id = request.id and o.completed_at is null) then
    blockers := array_append(blockers, 'CARE_OPERATION_IN_PROGRESS');
  elsif exists (select 1 from public.request_care_operations o
    where o.request_id = request.id) then
    blockers := array_append(blockers, 'CARE_OPERATION_HISTORY_RETENTION');
  end if;
  if exists (select 1 from public.request_conversations c
    where c.anfrage_id = request.id)
    or exists (select 1 from public.request_messages m
      where m.anfrage_id = request.id)
  then
    blockers := array_append(blockers, 'MESSAGING_RETENTION');
  end if;
  if exists (select 1 from public.anfragen_reengagement_log l
    where l.anfrage_id = request.id) then
    blockers := array_append(blockers, 'REENGAGEMENT_RETENTION');
  end if;
  if exists (select 1 from public.client_link_recovery_queue q
    where q.request_id is not null and case
      when trim(q.request_id) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then trim(q.request_id)::uuid = request.id
      else true
    end) then
    blockers := array_append(blockers, 'RECOVERY_QUEUE_REVIEW');
  end if;
  if exists (select 1 from public.sessions s where s.anfrage_id = request.id)
    or exists (select 1 from public.invoices i where i.anfrage_id = request.id)
  then
    blockers := array_append(blockers, 'BILLING_RETENTION');
  end if;
  if exists (select 1 from public.blocked_slots b where b.anfrage_id = request.id)
    or exists (select 1 from public.appointment_proposals p where p.anfrage_id = request.id)
  then
    blockers := array_append(blockers, 'APPOINTMENT_OR_CALENDAR_REVIEW');
  end if;

  if cardinality(blockers) > 0 then
    return jsonb_build_object(
      'deleted', false,
      'code', 'REQUEST_DELETE_BLOCKED',
      'blockers', blockers
    );
  end if;

  -- These short-lived access challenges are not retention evidence. The
  -- request lock serializes issuance/consumption; the delete stays atomic.
  delete from public.client_link_recovery where request_id = request.id;
  delete from public.anfragen where id = request.id;
  if not found then raise exception 'REQUEST_DELETE_FAILED'; end if;

  return jsonb_build_object('deleted', true);
end;
$$;

revoke all on function public.privacy_delete_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.privacy_delete_request(uuid, uuid) to service_role;
revoke all on function public.privacy_lock_recovery_queue_request() from public, anon, authenticated;

commit;
