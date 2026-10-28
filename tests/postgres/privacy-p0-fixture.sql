-- Synthetic prerequisite model, NOT a production schema or schema export.
-- Loaded only by the explicitly approved, disposable, networkless runner.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create table public.team_members (
  id uuid primary key, user_id uuid unique, active boolean, role text,
  available_for_intake boolean, name text, email text
);
create table public.anfragen (
  id uuid primary key default gen_random_uuid(),
  assigned_therapist_id uuid references public.team_members(id),
  booking_token uuid default gen_random_uuid(), status text, match_state text,
  vorname text, nachname text, email text, telefon text, strasse_hausnr text,
  plz_ort text, geburtsdatum date, beschaeftigungsgrad text, coaching_typ text,
  wunschtherapeut text, admin_therapeuten uuid[], structured_time_preference jsonb,
  themen text[], anliegen text, leidensdruck integer, verlauf text, diagnose text,
  ziel text, check_suizid boolean, terminwunsch_text text,
  bevorzugte_zeit timestamptz, check_datenschutz boolean, check_online_setting boolean,
  draft_recovery_consent boolean, draft_recovery_consent_at timestamptz,
  draft_recovery_consent_version text, draft_last_activity_at timestamptz,
  draft_current_step integer, invoice_with_vat boolean,
  meeting_link_override text
);
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  anfrage_id uuid references public.anfragen(id) on delete restrict,
  therapist_id uuid, date timestamptz, duration_min numeric,
  price numeric, commission numeric, payout numeric, google_event_id text
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  anfrage_id uuid references public.anfragen(id) on delete restrict,
  therapist_id uuid, invoice_number text, invoice_date date, service_period text,
  customer_number text, contact_person text, client_name text, client_street text,
  client_city text, client_country text, client_email text, salutation text,
  intro_text text, payment_terms text, closing_text text, vat_rate numeric,
  total_net numeric, vat_amount numeric, total_gross numeric, line_items jsonb,
  updated_at timestamptz default now(), sevdesk_invoice_id text
);
create table public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  anfrage_id uuid references public.anfragen(id) on delete restrict,
  therapist_id uuid, start_at timestamptz, end_at timestamptz,
  reason text, google_event_id text
);
create table public.appointment_proposals (
  id uuid primary key default gen_random_uuid(),
  anfrage_id uuid references public.anfragen(id) on delete restrict,
  therapist_id uuid, date timestamptz, expires_at timestamptz,
  google_event_id text
);
create table public.coach_invoices (
  id uuid primary key, coach_id uuid, sevdesk_invoice_id text
);
create table public.synthetic_unclassified_dependents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.anfragen(id) on delete restrict
);

alter table public.team_members enable row level security;
create policy fixture_members on public.team_members for select
  to authenticated using (user_id = auth.uid());
grant select on public.team_members to authenticated;
grant all on all tables in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
-- Deliberately broad legacy grants: the candidate must remove table AND column rights.
grant all on public.anfragen, public.sessions, public.invoices,
  public.blocked_slots, public.appointment_proposals to anon, authenticated;
grant select (anliegen), update (anliegen) on public.anfragen to authenticated;

-- Reproduce the user-reported production INSERT exposure, including column grants.
alter table public.sessions enable row level security;
create policy "allow inserts from api" on public.sessions
  as permissive for insert to public with check (true);
grant insert (anfrage_id, therapist_id, date, price) on public.sessions
  to public, anon, authenticated;

create schema privacy_test;
create function privacy_test.id(n bigint) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function privacy_test.check_that(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ACCEPTANCE_FAILED: %', label; end if;
end;
$$;
create function privacy_test.rejects(statement text, expected_state text, expected_message text)
returns void language plpgsql as $$
declare actual_state text; actual_message text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual_state = returned_sqlstate, actual_message = message_text;
  end;
  if actual_state is distinct from expected_state
    or (expected_message is not null and position(expected_message in actual_message) = 0) then
    raise exception 'ACCEPTANCE_FAILED: expected % / %, got % / %',
      expected_state, expected_message, actual_state, actual_message;
  end if;
end;
$$;
grant usage on schema privacy_test to anon, authenticated, service_role;
grant execute on all functions in schema privacy_test to anon, authenticated, service_role;

insert into public.team_members(id, user_id, active, role, available_for_intake, name, email)
select privacy_test.id(n), privacy_test.id(1000+n), n <> 4,
  case when n = 3 then 'admin' else 'therapist' end, true,
  'Synthetic Coach ' || n, 'coach-' || n || '@example.invalid'
from generate_series(1,5) n;
insert into public.anfragen(id, assigned_therapist_id, booking_token, status,
  anliegen, meeting_link_override, invoice_with_vat)
values (privacy_test.id(900), privacy_test.id(1), privacy_test.id(100900), 'active',
  'SYNTHETIC_HEALTH_ONLY', 'https://meeting.example.invalid/legacy', true);
insert into public.sessions(id, anfrage_id, therapist_id, date, duration_min, price, google_event_id)
values (privacy_test.id(901), privacy_test.id(900), privacy_test.id(1),
  '2000-01-01T10:00:00Z', 50.5, 80, 'synthetic-old-event');
insert into public.invoices(id, anfrage_id, therapist_id, invoice_number, total_gross,
  client_email, line_items, sevdesk_invoice_id)
values (privacy_test.id(902), privacy_test.id(900), privacy_test.id(1),
  'SYNTHETIC-OLD', 80, 'client@example.invalid',
  jsonb_build_array(jsonb_build_object('session_id', privacy_test.id(901), 'total', 80)),
  'synthetic-sevdesk-id');
insert into public.coach_invoices values
  (privacy_test.id(903), privacy_test.id(1), 'synthetic-coach-sevdesk-id');
