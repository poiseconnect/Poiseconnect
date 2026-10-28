-- Prepared only. No application data or backend privileges are changed.
begin;

drop policy if exists "allow inserts from api" on public.sessions;

revoke insert on table public.sessions from public, anon, authenticated;
do $$
declare session_column record;
begin
  for session_column in
    select attname from pg_catalog.pg_attribute
    where attrelid = 'public.sessions'::regclass
      and attnum > 0 and not attisdropped
  loop
    execute format('revoke insert (%I) on table public.sessions from public, anon, authenticated',
      session_column.attname);
  end loop;
end;
$$;

commit;
