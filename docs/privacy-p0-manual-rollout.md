# P0: Manueller Session-INSERT-Lockdown

Stand: 28. Oktober 2026. **Session-Hotfix laut Nutzer produktiv angewendet
und auf Berechtigungsebene verifiziert.**
Die folgenden Schritte sind als historisches Runbook erhalten, nicht erneut
auszufuehren. Laut Nutzer wurde ausschliesslich
`20261028020000_sessions_insert_lockdown.sql` am 28.10.2026 manuell im
produktiven Supabase SQL Editor ausgefuehrt. Alle sieben Nachpruefungen
ergaben `true`: offene Policy entfernt, RLS aktiv, INSERT fuer `anon` und
`authenticated` gesperrt, INSERT fuer `service_role` und `postgres` erhalten,
`service_role` weiterhin BYPASSRLS. Keine eigene Produktivverifikation durch
den Agenten. Kein produktiver End-to-End-Test, kein Deployment und keine
weitere P0-Migration angewendet.

Die manuelle Anwendung ist bei spaeterer Abstimmung der Supabase-
Migrationshistorie zu beruecksichtigen: weder automatisch wiederholen noch
ohne gesonderte Pruefung als angewendet markieren. Naechster, noch gesperrter
Schritt: [Zugriffsmigration vorbereiten](privacy-p0-phase1-rollout.md).

Der Agent stellt keine Produktivverbindung her, auch nicht read-only.
Alle nachfolgenden SQL-Bloecke sind ausschliesslich fuer eine berechtigte
Person im Supabase SQL Editor bestimmt, **erst nach ausdruecklicher Freigabe**.
Keine CLI-Migrationsserie, kein Deployment und keine Provideraktion ausloesen.

## 1. Eigenstaendigkeit und Auswirkung

Die erste Datei ist
[20261028020000_sessions_insert_lockdown.sql](../supabase/migrations/20261028020000_sessions_insert_lockdown.sql).
Sie benoetigt nur die vorhandene Basistabelle `public.sessions`, die Rollen
`anon`/`authenticated`, PostgreSQL-Kataloge sowie ausreichende DDL-/Grantrechte
der ausfuehrenden Person. Sie verwendet keine Care-Spalten, P0-RPCs, Consent-,
Messaging- oder Recoverytabellen. Keine andere P0-Migration muss vorausgehen.
Dies wurde im isolierten PostgreSQL-15-Lauf vor dem breiteren P0-Entwurf
getestet: Browser-INSERTs abgewiesen, Backend-INSERT erlaubt, 19 anschliessende
P0-Nebenlaeufigkeitsfaelle bestanden.

Die Migration entfernt genau die Policy `allow inserts from api` und nur
INSERT-Tabellen-/Spaltengrants fuer `PUBLIC`, `anon`, `authenticated`.
Sie aendert keine Datensaetze, RLS-Aktivierung, anderen Policies,
SELECT-/UPDATE-/DELETE-Rechte oder direkten Backend-/Ownergrants.
**Achtung:** `PUBLIC` gilt fuer alle Rollen. Ein Backend, das INSERT nur
ueber PUBLIC oder die entfernte Policy erhaelt, koennte mittelbar betroffen
sein. Deshalb sind direkte Backendrechte und RLS-Bypass unten Vorbedingungen.
Keine neuen Grants oder Ersatzpolicies spontan hinzufuegen.

## 2. Voraussetzungen und Sicherung vor der Freigabe

Ohne Produktivzugriff **nicht bestaetigt**:

- Richtiges Supabase-Projekt und Datenbank, PostgreSQL-Version,
  aktuelle DDL-/Policy-/ACL-Struktur, ausreichende Rechte des SQL-Editor-Users.
- `sessions` ist die erwartete normale Tabelle mit aktivierter RLS.
  Partitionierte/abweichende Tabellenstruktur: stoppen, separat pruefen.
- Tatsaechlich produktive Session-APIs verwenden `service_role`, mit direktem
  INSERT-Grant und `BYPASSRLS`; kein produktiver legitimer Browser-INSERT.
  Lokaler Code und Tests belegen dies nur fuer den Repository-Stand.
- Keine weiteren geerbten INSERT-Rechte der Browserrollen oder abweichende
  privilegierte RPC-/View-Schreibwege. Effektive Rechte werden unten geprueft;
  ein vollstaendiger RPC-Audit ist nicht Bestandteil dieser kleinen Migration.
- Aktueller Backup-/PITR-Status, Wiederherstellungsverfahren und zustaendige
  Person sind intern bestaetigt. Kein Datenbankdump und kein Restore hier.

Vorherige Policydefinition und vollstaendige Tabellen-/Spalten-ACLs mit dem
folgenden **reinen Metadatenreport** intern sichern, inklusive Zeitpunkt,
Projektbestaetigung, freigegebener Dateiversion und ausfuehrender Person.
Keine Secrets, Anwendungszeilen oder ungeprueften Metadaten in Tickets/Chat
kopieren. Die Sicherung ermoeglicht einen gezielten Forward-Fix; sie ist
**keine Erlaubnis zur Wiederherstellung der unsicheren Browserfreigabe**.

### Vorpruefung im SQL Editor (nur nach Freigabe)

Alle vier Resultsets intern sichern. Fehlende Objekte, unklare Rechte oder
Abweichungen vom gemeldeten Befund: **stoppen**, nicht automatisch reparieren.

```sql
begin transaction read only;

select current_database() as database_name,
       current_user as executed_as,
       current_setting('server_version') as postgres_version;

select c.oid::regclass::text as relation,
       c.relkind, c.relrowsecurity, c.relforcerowsecurity,
       c.relowner::regrole::text as owner, c.relacl as table_acl,
       a.attname as column_name, a.attacl as column_acl
from pg_catalog.pg_class c
join pg_catalog.pg_attribute a on a.attrelid = c.oid
where c.oid = to_regclass('public.sessions')
  and a.attnum > 0 and not a.attisdropped
order by a.attnum;

select policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public' and tablename = 'sessions'
order by policyname;

select r.rolname, r.rolsuper, r.rolbypassrls,
       has_table_privilege(r.oid, 'public.sessions', 'INSERT') as effective_table_insert,
       has_any_column_privilege(r.oid, 'public.sessions', 'INSERT') as effective_column_insert,
       exists (
         select 1
         from pg_catalog.pg_class c,
              lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x
         where c.oid = 'public.sessions'::regclass
           and x.grantee = r.oid and x.privilege_type = 'INSERT'
       ) as direct_insert_acl
from pg_catalog.pg_roles r
where r.rolname in ('anon', 'authenticated', 'service_role', 'postgres')
order by r.rolname;

rollback;
```

**Freigabekriterien:** Projekt stimmt; `relkind = 'r'`;
`relrowsecurity = true`; Policy entspricht dem gemeldeten
`PERMISSIVE / {public} / INSERT / true`. `anon` und `authenticated` sind
weder Superuser noch BYPASSRLS. `service_role` hat `direct_insert_acl = true`
und `rolbypassrls = true`, sowie effektive INSERT-Rechte. Owner-/postgres-
Rechte intern bestaetigt. Wenn die Policy schon fehlt oder INSERT schon
entzogen ist, erst bisherigen Rolloutstand klaeren statt blind wiederholen.
Weitere INSERT-/ALL-Policies intern festhalten; sie werden nicht entfernt.
Andere Rollenvererbungen koennen trotz Revokes Rechte erhalten.

## 3. Exakte erste Migration

Nur diesen vollstaendigen Block als eine Ausfuehrung verwenden. Er entspricht
der vorbereiteten Datei; keine anderen Migrationen mit ausfuehren.
Bei Fehlern nicht weiterarbeiten: die Transaktion muss zurueckgerollt werden.

```sql
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
```

## 4. Erfolgskontrolle: nur Kataloge, kein Test-INSERT in Produktion

Nach erfolgreichem Commit diesen Block separat ausfuehren. Alle sieben
Ergebniswerte muessen `true` sein. `NULL`/`false` bedeutet **nicht bestanden**.

```sql
begin transaction read only;

select
  not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'sessions'
      and policyname = 'allow inserts from api'
  ) as open_policy_removed,
  (select relrowsecurity from pg_catalog.pg_class
   where oid = 'public.sessions'::regclass) as rls_still_enabled,
  (not has_table_privilege('anon', 'public.sessions', 'INSERT')
   and not has_any_column_privilege('anon', 'public.sessions', 'INSERT'))
    as anon_insert_denied,
  (not has_table_privilege('authenticated', 'public.sessions', 'INSERT')
   and not has_any_column_privilege('authenticated', 'public.sessions', 'INSERT'))
    as authenticated_insert_denied,
  has_table_privilege('service_role', 'public.sessions', 'INSERT')
    as backend_insert_preserved,
  (select rolbypassrls from pg_catalog.pg_roles
   where rolname = 'service_role') as backend_rls_bypass_preserved,
  has_table_privilege('postgres', 'public.sessions', 'INSERT')
    as owner_role_insert_preserved;

rollback;
```

Zusaetzlich den Metadatenreport aus Abschnitt 2 erneut ausfuehren und intern
mit der Sicherung vergleichen: Nur die benannte Policy und die drei
Browser-/PUBLIC-INSERT-Grants samt INSERT-Spaltenrechten duerfen abweichen.
Insbesondere direkte service_role-/Ownergrants, RLS und andere Rechte
muessen identisch bleiben. Eine reine ACL-Umsortierung ist kein Rechtewechsel.
Keine SELECTs auf Session-, Rechnungs-, Nachrichten- oder Klienteninhalte.
Kein INSERT als Berechtigungstest: unbekannte Trigger koennten externe
Effekte ausloesen, auch bei anschliessendem ROLLBACK.

## 5. Fehler und Wiederherstellung

- **Vor Commit / SQL-Fehler:** In derselben noch offenen Transaktion
  `ROLLBACK;` ausfuehren. Nicht von einem Rollback einer spaeteren, neuen
  SQL-Editor-Verbindung ausgehen; bei unklarem Transaktionsausgang den
  Metadatenreport wiederholen. Keine weiteren DDL-Befehle improvisieren.
- **Nach Commit / unerwartete Browserrechte:** keine erfolgreiche Abnahme
  melden; weitere Rollenvererbungen gezielt klaeren. Nicht RLS abschalten.
- **Nach Commit / Backendfehler:** betroffene Erstellung organisatorisch
  pausieren; keine pauschalen Retries bei unklarem Kalender-/DB-Ergebnis.
  Vorher-/Nachher-ACLs vergleichen und nur einen gesondert freigegebenen
  minimalen Forward-Fix fuer den belegten Backendzugang vorbereiten.
- **Kein automatischer Sicherheits-Rollback:** Die Policy
  `WITH CHECK (true) TO public` oder Browser-INSERT-Grants werden nicht
  wiederhergestellt. Eine vollstaendige Ruecknahme wuerde die bestaetigte
  Luecke wieder oeffnen. Keine Datensicherung einspielen: diese Migration
  aendert keine Daten, ein Datenrestore koennte andere Arbeit ueberschreiben.

## 6. Kurzer Funktionstest ohne reale Provider-/Datenaktionen

Nach der manuellen Metadatenkontrolle: auf isolierter synthetischer
Testumgebung mit entsprechendem Schema und gemockten Providern pruefen.
Das ist kein positiver produktiver End-to-End-Nachweis. Echte produktive
Buchungen, Sitzungsanlage, Rechnungsversand und sevDesk-Erstellung bleiben
ohne gesonderte Freigabe untersagt.

| Ablauf | Erwartung / bereits vorhandener Nachweis |
|---|---|
| Tokenbasierte Folgebuchung | Erfolgreicher Session-INSERT, gespeicherter Coach/Tarif, Operationsabschluss; separater Kalendertermin nur im Mock, Verfuegbarkeitsblock unveraendert. |
| Coach-/Admin-Sitzungserfassung | Einzel- und Batchanlage erfolgreich fuer berechtigte Staffrolle; fremde Zuordnung/veraltete Version abgewiesen. |
| Rechnungsablaeufe | Eigene historische Abrechnung getrennt von laufender Akte; gespeicherte Positionen/Owner/sevDesk-Referenzen bleiben unveraendert; Versand/Provider nur als Mock. |
| Direkter Browserzugriff | SQL-Tests als `anon`/`authenticated` scheitern mit `42501`, auch mit passender Zuordnung; `service_role` darf erstellen. |

Vorhandene Tests: [Session-SQL](../tests/postgres/privacy-p0-session-inserts.sql),
[Termin-/Sessionrouten](../tests/api/appointmentCareProtections.test.js),
[historische Abrechnung](../tests/api/historicalBillingAccess.test.js),
[sevDesk-Route](../tests/api/sevdeskCoachInvoiceRoute.test.js).
847 Vitest-Tests sowie die isolierte PostgreSQL-15-Abnahme mit 19
Nebenlaeufigkeitsfaellen bestanden. Keine neue DB-Testausfuehrung fuer
diese Anleitung erfolgt.

## 7. Anschliessende P0-Reihenfolge: nur vorbereiten

Der hoehere Dateizeitstempel des zuerst auszufuehrenden Lockdowns ist
beabsichtigt: isolierter Hotfix ohne Care-Abhaengigkeit. Manuelle Anwendung
intern dokumentieren; keine `supabase db push`-Serie und keine blinde
Umsortierung/Umbenennung vorhandener Migrationen. Manuelles SQL registriert
nicht automatisch die CLI-Migrationshistorie; deren spaetere Abstimmung
braucht einen eigenen kontrollierten Ablauf.

1. Session-INSERT-Hotfix separat abnehmen. Er benoetigt kein neues Deployment.
2. Vor dem breiteren P0-Rollout Basisschema, bereits angewendete Foundation-
   Migrationen und Rollenstand anhand verfuegbarer freigegebener Unterlagen
   bestaetigen; unbekannter Stand ist ein Blocker, kein Anlass zu Blind-DDL.
   Voraussetzungen sind Messaging
   `20260901000000_request_messaging_foundation.sql`, Re-Engagement
   `20261005000000_admin_reengagement_log.sql`, Recovery
   `20261016000000_client_link_recovery.sql` und Consent
   `20261017000000_anfrage_health_data_consent.sql`. Vorhandene Foundation-
   Tabellen nicht erneut erzeugen; fehlende Voraussetzungen gesondert planen.
3. Koordinierten Code-/Schema-Rollout und Wartungsfenster separat freigeben:
   laufende Worker/Traffic kontrollieren, Fail-closed-Zwischenzustaende
   beruecksichtigen. Der breite Entwurf entzieht auch andere Browserrechte;
   nicht ohne passende serverseitige API-/UI-Version anwenden.
4. Erst dann
   [20261028000000_privacy_phase1_access.sql](../supabase/migrations/20261028000000_privacy_phase1_access.sql),
   danach
   [20261028010000_privacy_delete_request.sql](../supabase/migrations/20261028010000_privacy_delete_request.sql).
   Beide sind auf bestehende Foundations angewiesen; keine automatische
   Erweiterung historischer Consents. Loeschblocker/Retention bleiben bestehen.
5. Gesamtabnahme gemaess
   [P0-Abnahmebericht](privacy-p0-acceptance.md); Inhalts-Messaging bleibt
   deaktiviert. Fremde/parallele Abrechnungsmigrationen nicht in dieses
   Paket aufnehmen.

**Aktueller Freigabepunkt:** Der Session-Hotfix ist laut Nutzer bereits
angewendet; dieses historische Runbook nicht erneut ausfuehren.
Es besteht keine Freigabe fuer weitere P0-Migrationen, Datenmutation,
Deployment oder Provideraktionen. Der Agent bleibt ohne Produktivzugriff.
