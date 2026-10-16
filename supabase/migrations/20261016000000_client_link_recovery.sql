begin;

-- Additive prerequisite only. Apply separately after schema/role review.
create table public.client_link_recovery_limits (
  bucket timestamptz not null,
  key text not null,
  attempts integer not null default 1,
  primary key (bucket, key)
);

create table public.client_link_recovery_queue (
  id bigint generated always as identity primary key,
  email text,
  request_id text,
  legacy_proposal text,
  purpose text,
  secret_hash text,
  encrypted_secret text,
  email_key text,
  source_key text,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'no_match')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  claim_token uuid,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index client_link_recovery_queue_ready_idx
  on public.client_link_recovery_queue(available_at, created_at)
  where status in ('queued', 'processing');

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
alter table public.client_link_recovery_queue enable row level security;
revoke all on public.client_link_recovery, public.client_link_recovery_limits,
  public.client_link_recovery_queue from public, anon, authenticated;
grant select, insert, update, delete on public.client_link_recovery,
  public.client_link_recovery_limits, public.client_link_recovery_queue to service_role;
grant usage, select on sequence public.client_link_recovery_queue_id_seq to service_role;
create policy client_link_recovery_service on public.client_link_recovery
  for all to service_role using (true) with check (true);
create policy client_link_recovery_limits_service on public.client_link_recovery_limits
  for all to service_role using (true) with check (true);
create policy client_link_recovery_queue_service on public.client_link_recovery_queue
  for all to service_role using (true) with check (true);

create function public.enqueue_client_link_recovery(
  p_email text, p_request_id text, p_legacy_proposal text, p_purpose text,
  p_secret_hash text, p_encrypted_secret text, p_email_key text, p_source_key text
)
returns boolean
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  v_bucket timestamptz := date_trunc('hour', now());
  v_count integer;
begin
  if p_purpose is null or p_purpose not in ('draft', 'coach-selection', 'appointment', 'proposal')
     or p_secret_hash !~ '^[a-f0-9]{64}$'
     or p_encrypted_secret is null or length(p_encrypted_secret) > 256
     or p_email_key is null
     or p_email_key !~ '^[a-f0-9]{64}$'
     or p_source_key is null
     or p_source_key !~ '^[a-f0-9]{64}$'
     or p_email is null or length(p_email) > 254
     or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(coalesce(p_request_id, '')) > 100
     or length(coalesce(p_legacy_proposal, '')) > 100 then return false; end if;

  insert into public.client_link_recovery_limits(bucket, key)
  values (v_bucket, p_source_key)
  on conflict (bucket, key) do update
    set attempts = client_link_recovery_limits.attempts + 1
  returning attempts into v_count;
  if v_count > 10 then return false; end if;

  insert into public.client_link_recovery_limits(bucket, key)
  values (v_bucket, p_email_key)
  on conflict (bucket, key) do update
    set attempts = client_link_recovery_limits.attempts + 1
  returning attempts into v_count;
  if v_count > 3 then return false; end if;

  insert into public.client_link_recovery_queue(
    email, request_id, legacy_proposal, purpose, secret_hash,
    encrypted_secret, email_key, source_key
  ) values (
    lower(trim(p_email)), nullif(p_request_id, ''), nullif(p_legacy_proposal, ''),
    p_purpose, p_secret_hash, p_encrypted_secret, p_email_key, p_source_key
  );

  delete from public.client_link_recovery where expires_at < now() - interval '1 day';
  delete from public.client_link_recovery_limits where bucket < now() - interval '1 day';
  delete from public.client_link_recovery_queue
    where status in ('sent', 'no_match') and finished_at < now() - interval '1 day';
  return true;
end;
$$;

create function public.issue_client_link_recovery(
  p_email text, p_request_id text, p_legacy_proposal text, p_purpose text,
  p_secret_hash text, p_email_key text, p_source_key text
)
returns table(recipient text)
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  v_request public.anfragen%rowtype;
  v_id uuid;
  v_candidates uuid[];
  v_existing public.client_link_recovery%rowtype;
begin
  if p_purpose is null or p_purpose not in ('draft', 'coach-selection', 'appointment', 'proposal')
     or p_secret_hash !~ '^[a-f0-9]{64}$'
     or p_email_key is null
     or p_email_key !~ '^[a-f0-9]{64}$'
     or p_source_key is null
     or p_source_key !~ '^[a-f0-9]{64}$'
     or p_email is null or length(p_email) > 254 then return; end if;

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

  select * into v_existing from public.client_link_recovery
    where secret_hash = p_secret_hash for update;
  if found then
    if v_existing.request_id <> v_id or v_existing.recipient is distinct from v_request.email
       or v_existing.purpose <> p_purpose or v_existing.consumed_at is not null
       or v_existing.token_fingerprint <> coalesce(md5(v_request.booking_token::text), '') then
      return;
    end if;
    update public.client_link_recovery set expires_at = now() + interval '15 minutes'
      where secret_hash = p_secret_hash;
    return query select v_existing.recipient::text;
    return;
  end if;

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

create function public.claim_client_link_recovery_queue(p_limit integer default 5)
returns table(
  job_id bigint, email text, request_id text, legacy_proposal text, purpose text,
  secret_hash text, encrypted_secret text, email_key text, source_key text,
  attempts integer, claim_token uuid
)
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 10);
begin
  return query
  with claimable as (
    select q.id
    from public.client_link_recovery_queue q
    where (q.status = 'queued' and q.available_at <= now())
       or (q.status = 'processing' and q.locked_until <= now())
    order by q.available_at, q.created_at
    for update skip locked
    limit v_limit
  )
  update public.client_link_recovery_queue q
     set status = 'processing',
         attempts = q.attempts + 1,
         locked_until = now() + interval '5 minutes',
         claim_token = gen_random_uuid()
    from claimable c
   where q.id = c.id
  returning q.id, q.email, q.request_id, q.legacy_proposal, q.purpose,
    q.secret_hash, q.encrypted_secret, q.email_key, q.source_key,
    q.attempts, q.claim_token;
end;
$$;

create function public.process_client_link_recovery_queue(p_job_id bigint, p_claim_token uuid)
returns table(recipient text)
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  v_job public.client_link_recovery_queue%rowtype;
begin
  select * into v_job from public.client_link_recovery_queue
   where id = p_job_id and status = 'processing'
     and claim_token = p_claim_token and locked_until > now()
   for update;
  if not found then return; end if;

  return query select r.recipient from public.issue_client_link_recovery(
    v_job.email, v_job.request_id, v_job.legacy_proposal, v_job.purpose,
    v_job.secret_hash, v_job.email_key, v_job.source_key
  ) r;
end;
$$;

create function public.finish_client_link_recovery_queue(
  p_job_id bigint, p_claim_token uuid, p_outcome text
)
returns boolean
language plpgsql security invoker
set search_path = public, pg_temp
as $$
begin
  if p_outcome not in ('sent', 'no_match') then return false; end if;
  update public.client_link_recovery_queue
     set status = p_outcome, email = null, request_id = null, legacy_proposal = null,
         purpose = null, secret_hash = null, encrypted_secret = null,
         email_key = null, source_key = null, locked_until = null,
         claim_token = null, finished_at = now()
   where id = p_job_id and status = 'processing' and claim_token = p_claim_token;
  return found;
end;
$$;

create function public.retry_client_link_recovery_queue(p_job_id bigint, p_claim_token uuid)
returns boolean
language plpgsql security invoker
set search_path = public, pg_temp
as $$
begin
  update public.client_link_recovery_queue
     set status = 'queued',
         available_at = now() + make_interval(secs =>
           least(3600, 30 * power(2, least(greatest(attempts - 1, 0), 7)))::integer),
         locked_until = null, claim_token = null
   where id = p_job_id and status = 'processing' and claim_token = p_claim_token;
  return found;
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
revoke all on function public.enqueue_client_link_recovery(text,text,text,text,text,text,text,text),
  public.claim_client_link_recovery_queue(integer),
  public.process_client_link_recovery_queue(bigint,uuid),
  public.finish_client_link_recovery_queue(bigint,uuid,text),
  public.retry_client_link_recovery_queue(bigint,uuid) from public, anon, authenticated;
grant execute on function public.issue_client_link_recovery(text,text,text,text,text,text,text) to service_role;
grant execute on function public.consume_client_link_recovery(text) to service_role;
grant execute on function public.enqueue_client_link_recovery(text,text,text,text,text,text,text,text),
  public.claim_client_link_recovery_queue(integer),
  public.process_client_link_recovery_queue(bigint,uuid),
  public.finish_client_link_recovery_queue(bigint,uuid,text),
  public.retry_client_link_recovery_queue(bigint,uuid) to service_role;

commit;
