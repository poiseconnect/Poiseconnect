begin;

-- Additive prerequisite only. Apply separately after schema/role review.
create table public.client_link_recovery_limits (
  bucket timestamptz not null,
  key text not null,
  attempts integer not null default 1,
  primary key (bucket, key)
);

create table public.client_link_recovery (
  secret_hash text primary key,
  request_id uuid not null references public.anfragen(id) on delete cascade,
  recipient text not null,
  token_fingerprint text not null,
  purpose text not null check (purpose in ('draft', 'coach-selection', 'appointment', 'proposal')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  consumed_at timestamptz
);
create index client_link_recovery_request_idx on public.client_link_recovery(request_id, created_at desc);

alter table public.client_link_recovery enable row level security;
alter table public.client_link_recovery_limits enable row level security;
revoke all on public.client_link_recovery, public.client_link_recovery_limits from public, anon, authenticated;
grant select, insert, update, delete on public.client_link_recovery, public.client_link_recovery_limits to service_role;
create policy client_link_recovery_service on public.client_link_recovery
  for all to service_role using (true) with check (true);
create policy client_link_recovery_limits_service on public.client_link_recovery_limits
  for all to service_role using (true) with check (true);

create function public.issue_client_link_recovery(
  p_email text, p_request_id text, p_legacy_proposal text, p_purpose text,
  p_secret_hash text, p_email_key text, p_source_key text
)
returns table(recipient text)
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  v_bucket timestamptz := date_trunc('hour', now());
  v_count integer;
  v_request public.anfragen%rowtype;
  v_id uuid;
  v_candidates uuid[];
begin
  if p_purpose not in ('draft', 'coach-selection', 'appointment', 'proposal')
     or p_secret_hash !~ '^[a-f0-9]{64}$'
     or p_email_key !~ '^[a-f0-9]{64}$'
     or p_source_key !~ '^[a-f0-9]{64}$'
     or p_email is null or length(p_email) > 254 then return; end if;

  -- Persistent atomic buckets: no instance-local limiter or concurrent over-send.
  insert into public.client_link_recovery_limits(bucket, key)
  values (v_bucket, p_source_key)
  on conflict (bucket, key) do update
    set attempts = client_link_recovery_limits.attempts + 1
  returning attempts into v_count;
  if v_count > 10 then return; end if;
  insert into public.client_link_recovery_limits(bucket, key)
  values (v_bucket, p_email_key)
  on conflict (bucket, key) do update
    set attempts = client_link_recovery_limits.attempts + 1
  returning attempts into v_count;
  if v_count > 3 then return; end if;

  if nullif(p_request_id, '') is not null then
    begin
      v_id := p_request_id::uuid;
    exception when invalid_text_representation then return;
    end;
  elsif nullif(p_legacy_proposal, '') is not null then
    if p_purpose <> 'proposal' then return; end if;
    begin
      -- Legacy send-proposals wrote request_id/proposed_at; current proposals
      -- use anfrage_id/date. Read both without requiring obsolete columns.
      select array_agg(distinct a.id) into v_candidates
      from public.appointment_proposals p
      join public.anfragen a on a.id::text = coalesce(to_jsonb(p)->>'anfrage_id', to_jsonb(p)->>'request_id')
      where coalesce(to_jsonb(p)->>'date', to_jsonb(p)->>'proposed_at')::timestamptz = p_legacy_proposal::timestamptz
        and lower(trim(a.email)) = p_email;
    exception when invalid_datetime_format or datetime_field_overflow then return;
    end;
    if coalesce(cardinality(v_candidates), 0) > 1 then return; end if;
    if cardinality(v_candidates) = 1 then v_id := v_candidates[1]; end if;
  end if;
  if v_id is null then
    -- Historical email-only redirects: ambiguous records require support, never guess.
    select array_agg(a.id) into v_candidates
    from (
      select id from public.anfragen
      where lower(trim(email)) = p_email
        and status not in ('beendet', 'papierkorb')
        and (p_purpose <> 'draft' or status = 'draft')
      limit 2
    ) a;
    if coalesce(cardinality(v_candidates), 0) <> 1 then return; end if;
    v_id := v_candidates[1];
  end if;

  select * into v_request from public.anfragen where id = v_id for update;
  if not found or lower(trim(v_request.email)) is distinct from p_email
     or v_request.status is null or v_request.status in ('beendet', 'papierkorb')
     or (p_purpose = 'draft' and v_request.status <> 'draft') then return; end if;
  if exists (select 1 from public.client_link_recovery r
    where r.request_id = v_id and r.created_at > now() - interval '1 minute') then return; end if;

  insert into public.client_link_recovery(secret_hash, request_id, recipient, token_fingerprint, purpose)
  values (p_secret_hash, v_id, v_request.email, coalesce(md5(v_request.booking_token::text), ''), p_purpose);

  -- Short retention: no health data or raw recovery/booking credentials are stored here.
  delete from public.client_link_recovery where expires_at < now() - interval '1 day';
  delete from public.client_link_recovery_limits where bucket < now() - interval '1 day';
  return query select v_request.email::text;
end;
$$;

create function public.consume_client_link_recovery(p_secret_hash text)
returns table(request_id text, booking_token text, purpose text, resume_step integer)
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  v_link public.client_link_recovery%rowtype;
  v_request public.anfragen%rowtype;
begin
  if p_secret_hash !~ '^[a-f0-9]{64}$' then return; end if;
  -- Lock request first, as issuance does; no request/challenge lock-order inversion.
  select a.* into v_request from public.anfragen a
    join public.client_link_recovery r on r.request_id = a.id
    where r.secret_hash = p_secret_hash for update of a;
  if not found then return; end if;
  select * into v_link from public.client_link_recovery r
    where r.secret_hash = p_secret_hash for update;
  if not found or v_link.consumed_at is not null or v_link.expires_at <= now()
     or v_request.email is distinct from v_link.recipient
     or coalesce(md5(v_request.booking_token::text), '') <> v_link.token_fingerprint
     or v_request.status is null or v_request.status in ('beendet', 'papierkorb')
     or (v_link.purpose = 'draft' and v_request.status <> 'draft') then return; end if;

  -- Truly old records may not yet have a booking credential. Initialize only after proof.
  if v_request.booking_token is null then
    update public.anfragen a set booking_token = gen_random_uuid()
      where a.id = v_request.id returning a.* into v_request;
  end if;
  update public.client_link_recovery r set consumed_at = now()
    where r.secret_hash = p_secret_hash;
  return query select v_request.id::text, v_request.booking_token::text,
    v_link.purpose, v_request.draft_current_step::integer;
end;
$$;

revoke all on function public.issue_client_link_recovery(text,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.consume_client_link_recovery(text) from public, anon, authenticated;
grant execute on function public.issue_client_link_recovery(text,text,text,text,text,text,text) to service_role;
grant execute on function public.consume_client_link_recovery(text) to service_role;

commit;
