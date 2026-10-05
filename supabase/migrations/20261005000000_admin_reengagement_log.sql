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

  if to_regclass('public.anfragen_reengagement_log') is not null then
    raise exception 'anfragen_reengagement_log already exists; do not re-run this initial migration';
  end if;
end;
$$;

-- Additive Spalte für die Dashboard-Anzeige "Zuletzt kontaktiert am …".
-- Wird ausschließlich vom neuen Endpoint nach einem erfolgreichen Versand
-- gesetzt; keine bestehende Logik liest oder schreibt dieses Feld.
alter table public.anfragen
  add column if not exists reengagement_last_sent_at timestamptz;

-- Additive, isoliertes Protokoll für die Admin-Aktion "Erneut Kontakt aufnehmen"
-- im Tab "Wartet auf Klient:in" (anfragen.status = 'admin_vorschlaege_gesendet').
-- Kein bestehendes Feld wird zweckentfremdet; anfragen.status und
-- anfragen.assigned_therapist_id bleiben von dieser Tabelle unberührt.
create table public.anfragen_reengagement_log (
  id uuid primary key default gen_random_uuid(),
  -- batch_id = Vorgangs-ID: vom Client vor dem ersten Versand erzeugt und bei
  -- einer Wiederholung desselben Vorgangs unverändert erneut mitgeschickt.
  batch_id uuid not null,
  anfrage_id uuid not null references public.anfragen(id) on delete restrict,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'unknown')),
  provider_message_id text,
  error_code text,
  -- team_members.id der ausführenden Admin-Person (gleiche Konvention wie
  -- z. B. accounting-settings.uid_confirmed_by), keine auth.users-Referenz.
  created_by uuid not null,
  reserved_at timestamptz not null default now(),
  finished_at timestamptz,
  -- Ein Eintrag pro (Vorgang, Anfrage): Grundlage der atomaren Reservierung
  -- in reserve_reengagement_attempt(). Verhindert parallele Doppelversände
  -- für dieselbe Anfrage innerhalb desselben Vorgangs.
  unique (batch_id, anfrage_id)
);

create index anfragen_reengagement_log_anfrage_idx
  on public.anfragen_reengagement_log (anfrage_id, reserved_at desc);

create index anfragen_reengagement_log_batch_idx
  on public.anfragen_reengagement_log (batch_id);

alter table public.anfragen_reengagement_log enable row level security;

-- Kein Browser-Zugriff: Die Tabelle wird ausschließlich über den
-- authentifizierten Admin-Endpoint mit dem Service-Role-Client gelesen und
-- geschrieben. Es werden bewusst keine Policies für anon/authenticated
-- angelegt (kein SELECT, kein INSERT, kein UPDATE aus dem Browser).
revoke all on table public.anfragen_reengagement_log from anon, authenticated;

-- Atomare Reservierung vor dem Provideraufruf:
-- - Kein bestehender Eintrag für (p_batch_id, p_anfrage_id) -> neuer Eintrag
--   mit status='queued' wird angelegt und zurückgegeben (Reservierung erfolgreich).
-- - Bestehender Eintrag mit status='failed' -> wird atomar auf 'queued'
--   zurückgesetzt und zurückgegeben (bewusste Wiederaufnahme eines eindeutig
--   fehlgeschlagenen Versands, weiterhin im selben Vorgang).
-- - Bestehender Eintrag mit status in ('queued','sent','unknown') -> die
--   WHERE-Bedingung des ON CONFLICT DO UPDATE greift nicht, es wird NICHTS
--   verändert und die Funktion gibt NULL zurück (Reservierung abgelehnt).
--   Der Aufrufer darf in diesem Fall den Provider NICHT aufrufen.
create or replace function public.reserve_reengagement_attempt(
  p_batch_id uuid,
  p_anfrage_id uuid,
  p_created_by uuid
)
returns public.anfragen_reengagement_log
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  reserved_row public.anfragen_reengagement_log;
begin
  insert into public.anfragen_reengagement_log (
    batch_id, anfrage_id, status, created_by, reserved_at, finished_at,
    provider_message_id, error_code
  )
  values (
    p_batch_id, p_anfrage_id, 'queued', p_created_by, now(), null, null, null
  )
  on conflict (batch_id, anfrage_id) do update
    set status = 'queued',
        created_by = excluded.created_by,
        reserved_at = now(),
        finished_at = null,
        provider_message_id = null,
        error_code = null
    where public.anfragen_reengagement_log.status = 'failed'
  returning * into reserved_row;

  -- reserved_row bleibt NULL, wenn 0 Zeilen betroffen waren (Reservierung
  -- abgelehnt). plpgsql wirft dafür ohne STRICT keine Exception.
  return reserved_row;
end;
$$;

revoke all on function public.reserve_reengagement_attempt(uuid, uuid, uuid) from public;
grant execute on function public.reserve_reengagement_attempt(uuid, uuid, uuid) to service_role;

commit;
