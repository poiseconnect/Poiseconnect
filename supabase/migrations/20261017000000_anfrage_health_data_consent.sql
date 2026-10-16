begin;

do $$
declare
  column_type text;
begin
  if to_regprocedure('gen_random_uuid()') is null then
    raise exception 'gen_random_uuid() is not available';
  end if;

  if to_regclass('public.anfragen') is null then
    raise exception 'Required source table public.anfragen does not exist';
  end if;

  select data_type into column_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'anfragen' and column_name = 'id';

  if column_type is distinct from 'uuid' then
    raise exception 'public.anfragen.id must be uuid, found %', coalesce(column_type, '<missing>');
  end if;

  if to_regclass('public.anfrage_health_data_consents') is not null then
    raise exception 'anfrage_health_data_consents already exists; do not re-run this initial migration';
  end if;
end;
$$;

create table public.anfrage_health_data_consents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  token_hash text not null unique,
  text_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint anfrage_health_data_consents_token_hash_check
    check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint anfrage_health_data_consents_text_version_check
    check (length(trim(text_version)) > 0)
);

create index anfrage_health_data_consents_request_idx
  on public.anfrage_health_data_consents(request_id, granted_at desc);

alter table public.anfrage_health_data_consents enable row level security;

revoke all on table public.anfrage_health_data_consents from public, anon, authenticated;
grant select, insert, update on table public.anfrage_health_data_consents to service_role;

create policy anfrage_health_data_consents_service_role_all
  on public.anfrage_health_data_consents
  for all
  to service_role
  using (true)
  with check (true);

commit;
