-- Run before the broad P0 access migration to prove the standalone correction.
select privacy_test.check_that(not exists(
  select 1 from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'sessions'
    and policyname = 'allow inserts from api'),
  'open session INSERT policy removed');
select privacy_test.check_that(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.sessions'::regclass),
  'session RLS remains enabled');

do $$
declare browser_role text; session_column record;
begin
  foreach browser_role in array array['anon', 'authenticated'] loop
    perform privacy_test.check_that(
      not has_table_privilege(browser_role, 'public.sessions', 'INSERT'),
      browser_role || ' has no table INSERT privilege');
    for session_column in
      select attname from pg_catalog.pg_attribute
      where attrelid = 'public.sessions'::regclass and attnum > 0 and not attisdropped
    loop
      perform privacy_test.check_that(
        not has_column_privilege(browser_role, 'public.sessions', session_column.attname, 'INSERT'),
        browser_role || ' has no column INSERT privilege: ' || session_column.attname);
    end loop;
    perform privacy_test.check_that(
      has_table_privilege(browser_role, 'public.sessions', 'SELECT')
      and has_table_privilege(browser_role, 'public.sessions', 'UPDATE')
      and has_table_privilege(browser_role, 'public.sessions', 'DELETE'),
      'standalone correction preserves unrelated legacy grants');
  end loop;
  perform privacy_test.check_that(
    has_table_privilege('service_role', 'public.sessions', 'INSERT')
      and has_table_privilege('postgres', 'public.sessions', 'INSERT'),
    'backend and owner INSERT privileges remain unchanged');
end;
$$;

begin;
set local role anon;
select privacy_test.rejects(
  'insert into public.sessions(anfrage_id,therapist_id,date,price)
    values(privacy_test.id(900),privacy_test.id(1),''2000-01-02T10:00:00Z'',80)',
  '42501', null);
select privacy_test.rejects('insert into public.sessions default values', '42501', null);
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', privacy_test.id(1001)::text, true);
select privacy_test.rejects(
  'insert into public.sessions(anfrage_id,therapist_id,date,price)
    values(privacy_test.id(900),privacy_test.id(1),''2000-01-02T10:00:00Z'',80)',
  '42501', null);
select privacy_test.rejects('insert into public.sessions default values', '42501', null);
rollback;

begin;
set local role service_role;
insert into public.sessions(id,anfrage_id,therapist_id,date,price)
values(privacy_test.id(950),privacy_test.id(900),privacy_test.id(1),'2000-01-02T10:00:00Z',80);
select privacy_test.check_that(exists(
  select 1 from public.sessions where id = privacy_test.id(950) and price = 80),
  'server role can still create a session');
rollback;

select privacy_test.check_that(
  (select jsonb_agg(payload order by category, payload::text) from privacy_test.legacy_snapshot)
  = (select jsonb_agg(payload order by category, payload::text) from (
      select 'sessions' as category, to_jsonb(s) as payload from public.sessions s
      union all select 'invoices', to_jsonb(i) from public.invoices i
      union all select 'coach_invoices', to_jsonb(c) from public.coach_invoices c
    ) current_rows),
  'standalone INSERT correction preserves historical finance and provider links');
