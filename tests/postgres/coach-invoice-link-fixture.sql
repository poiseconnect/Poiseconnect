create role anon;
create role authenticated;
create role service_role;
create table public.team_members (
  id uuid primary key, user_id uuid unique, email text, profile_name text,
  name text, sevdesk_contact_id text, active boolean, role text
);
create table public.coach_invoices (
  id uuid primary key default gen_random_uuid(), coach_id uuid,
  billing_mode text, billing_year integer, billing_quarter integer,
  billing_month integer, bundle_key text, updated_at timestamptz default now(),
  sevdesk_invoice_id text
);
create unique index coach_invoices_unique_idx on public.coach_invoices
  (coach_id, billing_mode, billing_year, coalesce(billing_quarter, 0),
    coalesce(billing_month, 0), bundle_key);
create table public.sessions (
  id uuid primary key default gen_random_uuid(), date timestamptz, price numeric,
  therapist_id uuid, anfrage_id uuid
);
create table public.anfragen (
  id uuid primary key default gen_random_uuid(),
  invoice_with_vat boolean, beschaeftigungsgrad text
);
create table public.therapist_invoice_settings (
  therapist_id uuid unique, company_name text, address text, default_vat_rate numeric
);
insert into public.team_members(id, user_id, active, role)
select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, true, 'therapist'
from generate_series(1, 6) n;
insert into public.sessions(therapist_id, date, price)
select id, '2026-07-10T12:00:00Z', 100 from public.team_members;
insert into public.coach_invoices
  (coach_id, billing_mode, billing_year, billing_quarter, bundle_key, sevdesk_invoice_id)
select '00000000-0000-0000-0000-000000000004', 'quartal', 2026, q, b, external_id
from (values
  (3, 'normal_ust', '135675889'),
  (3, 'reverse_charge', '135675889'),
  (2, 'normal_ust', '135675889'),
  (4, 'normal_ust', '135833778'),
  (4, 'reverse_charge', '135833778')
) history(q, b, external_id);
