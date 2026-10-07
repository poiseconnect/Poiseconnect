-- Folgemigration zu 20261005000000_admin_reengagement_log.sql.
--
-- Befund: In Supabase vergeben Default-Privileges im Schema public direkte
-- EXECUTE-Grants an anon und authenticated auf neu angelegte Funktionen. Das
-- "revoke ... from public" der ersten Migration entzieht diese direkten Grants
-- nicht. Die Reservierungsfunktion war dadurch für anon/authenticated
-- ausführbar (die Tabelle selbst blieb durch fehlende Grants/RLS gesperrt).
--
-- Dieselbe Korrektur wurde im Produktionsprojekt bereits manuell ausgeführt
-- (und danach lesend verifiziert). Diese Datei hält sie im Repository fest.
-- Sie ist idempotent und darf nach der ersten Migration beliebig oft laufen.
-- Keine globalen Default-Privileges werden verändert.

begin;

revoke execute
  on function public.reserve_reengagement_attempt(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute
  on function public.reserve_reengagement_attempt(uuid, uuid, uuid)
  to service_role;

commit;
