begin;

do $$
declare
  column_type text;
begin
  if to_regprocedure('gen_random_uuid()') is null then
    raise exception 'gen_random_uuid() is not available';
  end if;

  if to_regclass('public.anfragen') is null or to_regclass('public.team_members') is null then
    raise exception 'Required source tables do not exist';
  end if;

  select data_type into column_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'anfragen' and column_name = 'id';

  if column_type is distinct from 'uuid' then
    raise exception 'public.anfragen.id must be uuid, found %', coalesce(column_type, '<missing>');
  end if;

  select data_type into column_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'team_members' and column_name = 'id';

  if column_type is distinct from 'uuid' then
    raise exception 'public.team_members.id must be uuid, found %', coalesce(column_type, '<missing>');
  end if;

  select data_type into column_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'team_members' and column_name = 'user_id';

  if column_type is distinct from 'uuid' then
    raise exception 'public.team_members.user_id must be uuid, found %', coalesce(column_type, '<missing>');
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'team_members'
      and column_name = 'active' and data_type = 'boolean'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'team_members' and column_name = 'role'
  ) then
    raise exception 'public.team_members requires active and role columns';
  end if;

  if to_regclass('public.request_conversations') is not null
    or to_regclass('public.request_messages') is not null
    or to_regclass('public.request_message_events') is not null then
    raise exception 'Messaging tables already exist; do not re-run this initial migration';
  end if;
end;
$$;

create table public.request_conversations (
  id uuid primary key default gen_random_uuid(),
  anfrage_id uuid not null references public.anfragen(id) on delete restrict,
  therapist_id uuid not null references public.team_members(id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'closed', 'review')),
  reply_alias text not null check (length(trim(reply_alias)) > 0),
  reply_token_hash text not null check (reply_token_hash ~ '^[a-f0-9]{64}$'),
  alias_revoked_at timestamptz,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  close_reason text,
  retention_until timestamptz,
  unique (id, anfrage_id),
  check (
    (status = 'open' and closed_at is null and alias_revoked_at is null)
    or (status = 'closed' and closed_at is not null and alias_revoked_at is not null)
    or status = 'review'
  )
);

create unique index request_conversations_reply_alias_key
  on public.request_conversations (reply_alias);

create unique index request_conversations_reply_token_hash_key
  on public.request_conversations (reply_token_hash);

create unique index request_conversations_one_open_per_request_key
  on public.request_conversations (anfrage_id)
  where status = 'open';

create index request_conversations_therapist_status_created_at_idx
  on public.request_conversations (therapist_id, status, created_at desc);

create index request_conversations_anfrage_created_at_idx
  on public.request_conversations (anfrage_id, created_at desc);

create table public.request_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid,
  anfrage_id uuid references public.anfragen(id) on delete restrict,
  direction text not null check (direction in ('outbound', 'inbound')),
  sender_role text not null check (sender_role in ('coach', 'client', 'system')),
  delivery_status text not null check (
    delivery_status in ('queued', 'sent', 'received', 'forwarded', 'failed', 'review')
  ),
  provider_message_id text,
  provider_email_id text,
  provider_event_id text,
  client_request_id uuid,
  subject text,
  text_body text,
  html_body text,
  received_to_alias text,
  created_at timestamptz not null default now(),
  retention_until timestamptz,
  constraint request_messages_conversation_pair_check check (
    (conversation_id is null and anfrage_id is null)
    or (conversation_id is not null and anfrage_id is not null)
  ),
  constraint request_messages_conversation_request_fkey
    foreign key (conversation_id, anfrage_id)
    references public.request_conversations (id, anfrage_id)
    on delete restrict
);

create unique index request_messages_provider_email_id_key
  on public.request_messages (provider_email_id)
  where provider_email_id is not null;

create unique index request_messages_conversation_client_request_id_key
  on public.request_messages (conversation_id, client_request_id)
  where client_request_id is not null;

create index request_messages_conversation_created_at_idx
  on public.request_messages (conversation_id, created_at);

create index request_messages_anfrage_created_at_idx
  on public.request_messages (anfrage_id, created_at);

create table public.request_message_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  unique (provider, provider_event_id)
);

alter table public.request_conversations enable row level security;
alter table public.request_messages enable row level security;
alter table public.request_message_events enable row level security;

revoke all on table public.request_conversations from anon, authenticated;
revoke all on table public.request_messages from anon, authenticated;
revoke all on table public.request_message_events from anon, authenticated;

grant select on public.request_conversations to authenticated;
grant select on public.request_messages to authenticated;

create policy "coaches read own request conversations"
  on public.request_conversations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.team_members member
      where member.id = request_conversations.therapist_id
        and member.user_id = auth.uid()
        and member.active = true
        and member.role = 'therapist'
    )
  );

create policy "coaches read own request messages"
  on public.request_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.request_conversations conversation
      join public.team_members member on member.id = conversation.therapist_id
      where conversation.id = request_messages.conversation_id
        and member.user_id = auth.uid()
        and member.active = true
        and member.role = 'therapist'
    )
  );

create or replace function public.ensure_open_request_conversation(
  p_anfrage_id uuid,
  p_therapist_id uuid,
  p_reply_alias text,
  p_reply_token_hash text
)
returns public.request_conversations
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  assigned_therapist uuid;
  current_conversation public.request_conversations;
  created_conversation public.request_conversations;
begin
  select assigned_therapist_id
  into assigned_therapist
  from public.anfragen
  where id = p_anfrage_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  if assigned_therapist is distinct from p_therapist_id then
    raise exception 'ASSIGNMENT_MISMATCH';
  end if;

  perform 1
  from public.team_members
  where id = p_therapist_id
    and active = true
    and role = 'therapist';

  if not found then
    raise exception 'THERAPIST_NOT_ACTIVE';
  end if;

  select *
  into current_conversation
  from public.request_conversations
  where anfrage_id = p_anfrage_id
    and status = 'open'
  for update;

  if found and current_conversation.therapist_id = p_therapist_id then
    return current_conversation;
  end if;

  if found then
    update public.request_conversations
    set status = 'closed',
        closed_at = now(),
        alias_revoked_at = now(),
        close_reason = 'therapist_changed'
    where id = current_conversation.id;
  end if;

  insert into public.request_conversations (
    anfrage_id,
    therapist_id,
    reply_alias,
    reply_token_hash
  )
  values (
    p_anfrage_id,
    p_therapist_id,
    p_reply_alias,
    p_reply_token_hash
  )
  returning * into created_conversation;

  return created_conversation;
end;
$$;

create or replace function public.close_open_request_conversation(
  p_anfrage_id uuid,
  p_reason text
)
returns public.request_conversations
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  closed_conversation public.request_conversations;
begin
  perform 1
  from public.anfragen
  where id = p_anfrage_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  update public.request_conversations
  set status = 'closed',
      closed_at = now(),
      alias_revoked_at = now(),
      close_reason = nullif(trim(p_reason), '')
  where anfrage_id = p_anfrage_id
    and status = 'open'
  returning * into closed_conversation;

  return closed_conversation;
end;
$$;

revoke all on function public.ensure_open_request_conversation(uuid, uuid, text, text) from public;
revoke all on function public.close_open_request_conversation(uuid, text) from public;
grant execute on function public.ensure_open_request_conversation(uuid, uuid, text, text) to service_role;
grant execute on function public.close_open_request_conversation(uuid, text) to service_role;

commit;