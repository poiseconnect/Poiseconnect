create table public.request_conversations (
  id uuid primary key default gen_random_uuid(),
  anfrage_id uuid not null references public.anfragen(id) on delete restrict,
  therapist_id uuid not null references public.team_members(id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'closed', 'review')),
  reply_alias text not null,
  reply_token_hash text not null,
  alias_revoked_at timestamptz,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  close_reason text,
  retention_until timestamptz,
  check (
    (status = 'open' and closed_at is null and alias_revoked_at is null)
    or status in ('closed', 'review')
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
  conversation_id uuid references public.request_conversations(id) on delete restrict,
  anfrage_id uuid references public.anfragen(id) on delete restrict,
  direction text not null check (direction in ('outbound', 'inbound')),
  sender_role text not null check (sender_role in ('coach', 'client', 'system')),
  delivery_status text not null check (
    delivery_status in ('queued', 'sent', 'received', 'forwarded', 'failed', 'review')
  ),
  provider_message_id text,
  provider_email_id text,
  provider_event_id text,
  subject text,
  text_body text,
  html_body text,
  received_to_alias text,
  created_at timestamptz not null default now(),
  retention_until timestamptz
);

create unique index request_messages_provider_email_id_key
  on public.request_messages (provider_email_id)
  where provider_email_id is not null;

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
security definer
set search_path = public
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
security definer
set search_path = public
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