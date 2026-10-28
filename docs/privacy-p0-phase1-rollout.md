# P0-Zugriffsmigration: Vorpruefung und gesperrter Rollout

Stand: 28. Oktober 2026. **Keine Migrations-/Deploymentfreigabe.**
Nur lokale Vorbereitung. Kein Produktivzugriff durch den Agenten.
Die SQL-Vorpruefungen sind fuer den Nutzer im bestaetigten Supabase-Projekt
bestimmt; sie lesen nur Kataloge, keine Anwendungszeilen. Nicht zusammen mit
einer Migration ausfuehren. Ergebnisse intern aufbewahren und nur bereinigte
Abweichungen/Status weitergeben, keine Rollen-/Projektkennungen oder Secrets.

## 1. Bestaetigter Ausgangspunkt und verbleibende Blocker

Laut Nutzer ist ausschliesslich
[20261028020000_sessions_insert_lockdown.sql](../supabase/migrations/20261028020000_sessions_insert_lockdown.sql)
seit 28.10.2026 produktiv angewendet; alle sieben Metadatenpruefungen waren
`true`. Kein Deployment, kein produktiver End-to-End-Test, keine andere
P0-Migration angewendet. Der Hotfix wird weder zurueckgenommen noch wiederholt.
Manuelle Anwendung spaeter kontrolliert mit der Migrationshistorie abstimmen,
keine automatische Markierung oder CLI-Migrationsserie.

Der naechste Kandidat ist
[20261028000000_privacy_phase1_access.sql](../supabase/migrations/20261028000000_privacy_phase1_access.sql).
Er wurde zusammen mit dem zuerst angewendeten Session-Hotfix synthetisch
in PostgreSQL 15 abgenommen: SQL/RLS/Trigger, Rollback und 19 Parallelfaelle.
Der breite Entzug von Sessionrechten widerspricht dem Hotfix nicht: INSERT
bleibt gesperrt; zusaetzlich entfaellt direkter Browserzugriff auf weitere
Operationen/Tabellen. Keine neue Browser-INSERT-Freigabe entsteht.

**Ein ausfallfreier Live-Rollout ist derzeit nicht belegbar und nicht
freigegeben.** Produktive Deployment-ID/Commit, zugehoeriger Quellstand,
laufende Worker/Crons und reale Basistypen/Constraints/Alttrigger sind nicht
bestaetigt. Lokaler Branch und HEAD allein sind kein Nachweis: Der
P0-Kandidat umfasst zahlreiche uncommittete/neue Dateien. Keine Zugangsdaten
zum Nachweis anfordern oder Produktionsendpunkte durch den Agenten pruefen.

## 2. Konkrete Voraussetzungen und Auswirkungen

| Bereich | Lokal nachgewiesen | Vor Rollout noch zu bestaetigen |
|---|---|---|
| Basistabellen | `anfragen`, `team_members`, `sessions`, `invoices`, `blocked_slots`, `appointment_proposals` werden als Rowtypes und fuer DML verwendet. Das synthetische Fixture modelliert sie, vollstaendige Create-Migrationen fehlen. | Vollstaendige Spalten/Typen, Defaults, Constraints, Indizes, Trigger und Backendgrants mit dem Fixture/Kandidaten abgleichen; keine Inhaltsabfrage. |
| Messaging-Foundation | `20260901000000_request_messaging_foundation.sql`: Conversations, Messages, Events; alte Policies werden exakt beim Namen entfernt. | Tabellen, Spalten, RLS und beide Alt-Policy-Namen vorhanden; keine abweichenden offenen Policies/privilegierten Views. Foundation nicht blind erneut anwenden. |
| Consent-Foundation | `20261017000000_anfrage_health_data_consent.sql`: Consent-ID/Request-ID, Hash, Textversion, grant/revoke-Zeit; Update-/Insertrechte fuer Backend. | Tabelle, Typen und Rechte; keine neuen P0-Spalten bereits vorhanden. Vorhandene Belege werden nicht als neue Empfaengerfreigabe interpretiert. |
| Recovery/Re-Engagement | Kein direkter Tabellenaufruf aus der Zugriffsmigration selbst; relevant fuer bestehende App und anschliessenden Loeschentwurf. | Foundations `20261016000000_client_link_recovery.sql` und `20261005000000_admin_reengagement_log.sql` fuer das Gesamtpaket bestaetigen. Fehlende/abweichende Foundations separat planen. |
| Rollen/Funktionen | `anon`, `authenticated`, `service_role`, `auth.uid()`, `gen_random_uuid()` vorausgesetzt. Nur RLS-Helper `privacy_coach_can_read` bekommt Browser-EXECUTE. | Effektive Rechte und Owner des SECURITY-DEFINER-Helpers kontrollieren; Testfixture-Grants sind kein Produktionsnachweis. |
| Dashboards | [Admin-/Staffreader](../app/api/dashboard/requests/route.js), [Coachreader](../app/api/team-requests/route.js), [Draftreader](../app/api/admin/form-drafts/route.js) nutzen serverseitige Gesundheitspruefung. [Dashboard](../app/dashboard/DashboardFull.jsx) uebermittelt Care-Versionen und verwendet Billing-APIs. | Diese API-/UI-Version gemeinsam produktiv verfuegbar. Alte Browserdirektzugriffe auf Anfrage/Sessions/Invoices/Slots/Proposals scheitern nach Entzug. |
| Intake/Consent | [Consent-API](../app/api/intake-consent/route.js) und [Formularsave](../app/api/form-submit/route.js) verwenden neue RPCs; Empfaengerfreigabe und Notice-Version verpflichtend. | Formular, API, Matcher und Consenttexte aus gleichem Kandidaten. Kein automatischer Backfill. Bestands-Coaches ohne neue Empfaengerfreigabe sehen keine Gesundheitsfelder; Admins nur bei gueltigem Consent, ohne Widerrufsausnahme. |
| Coach-Wechsel | [Handover](../app/api/coach-handover/route.js) nutzt atomaren RPC statt Kopie/direktem Ownerupdate. Trigger verbietet andere Owner-/Care-Updates. | Kein noch aktiver Altpfad/Worker mit direktem Zuordnungsupdate. Historische Sessions blockieren nicht pauschal; konkrete Zukunftstermine/offene Operationsclaims schon. Historische Owner und Termine bleiben unveraendert. |
| Buchung | [Care-Kontext/Claims](../app/lib/appointmentCare.js) sind neue notwendige RPCs. Child-Trigger pruefen Zuordnung und binden Proposals an Version. | Passender Code; nach Wechsel veraltete/ungebundene Altlinks abgewiesen. Unklare Providerclaims werden nicht automatisch freigegeben. |
| Abrechnung | [Invoice-Save](../app/api/invoices/save/route.js) nutzt neuen RPC; [Rechnungs-UI](../app/dashboard/rechnung/[id]/page.js) serverseitige Lade-/Save-APIs. Historische Abrechnung getrennt von laufender Akte. | Produktive UI/API entsprechen Kandidat; vorhandene Billing-Trigger und Ownerkonventionen kompatibel. Kein Umschreiben historischer Sessions/Rechnungen/sevDesk-IDs. |
| Inhalts-Messaging | SQL-Guards/RLS enthalten unerfuellbaren Messagingzweck; [JS-Dispatch](../app/lib/messaging/access.js) bleibt explizit pausiert. | Webhooks, Inbound-/Outbound-/Retryworker gemeinsam passend, vor Bodyabruf/-versand gesperrt. Kein Aktivierungsschalter, keine implizite Kommunikationsfreigabe. |
| Endloeschung | Neue Care-/Consentbeziehungen blockieren direkte Parent-Loeschung; lokale API erwartet `privacy_delete_request`. | Nachfolgende Loeschmigration getrennt genehmigen oder Endloeschung bis dahin kontrolliert gesperrt halten; nie auf direkten DELETE zurueckfallen. |

## 3. Lesende Vorpruefungen fuer den Nutzer

Das ist eine Bestandsaufnahme, **keine automatische Kompatibilitaetsampel**.
Unvollstaendige Katalogsicht der ausfuehrenden Rolle ist ein Blocker.
Die ersten Abfragen zeigen nur Struktur; Vorhandensein beweist keine
inhaltlich korrekte Berechtigung. Den vorhandenen
[Katalog-Preflight](../scripts/privacy-p0-schema-preflight.sql) kann der Nutzer
bei gesondert bestaetigtem Umfang ergaenzend verwenden; er ersetzt weder
Codevergleich noch vollstaendige Trigger-/View-/Funktionspruefung.

### A. Tabellen, Spalten, Typen und Kollisionen

Erwartung fuer Tabellenliste: alle zehn Objekte vorhanden, normale Tabellen.
Spalten mit `candidate_collision = true` duerfen **vor** der ersten
Zugriffsmigration nicht vorhanden sein. Fehlende benoetigte Basisspalten
anhand der vollstaendigen Ausgabe gegen den Kandidaten und
[Fixture](../tests/postgres/privacy-p0-fixture.sql) pruefen. UUIDs insbesondere
fuer Anfrage-/Team-/User-/Consent-/Conversation-/Session-/Invoice-IDs und
deren verwendete Referenzen; Datum-/Dauerfelder muessen die SQL-Ausdruecke
des Kandidaten unterstuetzen. Abweichungen nicht durch Casts improvisieren.

```sql
begin transaction read only;

select current_database() as database_name, current_user as executed_as,
       current_setting('server_version') as postgres_version;

with expected(name) as (
  values ('anfragen'), ('team_members'), ('sessions'), ('invoices'),
         ('blocked_slots'), ('appointment_proposals'),
         ('anfrage_health_data_consents'), ('request_conversations'),
         ('request_messages'), ('request_message_events')
)
select e.name, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
       c.relowner::regrole::text as owner
from expected e
left join pg_catalog.pg_class c
  on c.relnamespace = 'public'::regnamespace and c.relname = e.name
order by e.name;

select c.relname as table_name, a.attname as column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) as sql_type,
       a.attnotnull,
       case
         when c.relname = 'anfragen' then a.attname in
           ('care_version','care_episode_id','admin_coach_selection_version','meeting_link_care_version')
         when c.relname = 'anfrage_health_data_consents' then a.attname in
           ('coach_id','superseded_at')
         when c.relname = 'request_conversations' then a.attname = 'care_episode_id'
         when c.relname = 'appointment_proposals' then a.attname = 'care_version'
         else false
       end as candidate_collision
from pg_catalog.pg_class c
join pg_catalog.pg_attribute a on a.attrelid = c.oid
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('anfragen','team_members','sessions','invoices','blocked_slots',
    'appointment_proposals','anfrage_health_data_consents',
    'request_conversations','request_messages','request_message_events')
  and a.attnum > 0 and not a.attisdropped
order by c.relname, a.attnum;

select c.relname, c.relkind
from pg_catalog.pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('request_care_assignments','request_care_transfers',
    'request_health_authorizations','request_care_operations',
    'request_care_assignments_one_current');

select p.oid::regprocedure::text as existing_candidate_function
from pg_catalog.pg_proc p
where p.pronamespace = 'public'::regnamespace
  and left(p.proname, 8) = 'privacy_'
order by 1;

select to_regprocedure('auth.uid()') is not null as auth_uid_present,
       to_regprocedure('gen_random_uuid()') is not null as random_uuid_present;

rollback;
```

Die beiden Kollisionslisten fuer Care-Objekte und `privacy_`-Funktionen
sollten im gemeldeten Ausgangsstand leer sein. Andere vorhandene
`privacy_`-Funktionen sind nicht automatisch ein Konflikt, aber muessen
gegen die exakten Signaturen der Migration abgeglichen werden. `CREATE`
und `ADD COLUMN` sind nicht als Wiederholungs-/Reparaturmigration ausgelegt.

### B. Altpolicies, Rechte, Trigger und Constraints

Keine Triggerfunktion wird aufgerufen und kein Constraint geaendert.
Die Definitionstexte sind interne Metadaten; nicht ungeprueft weitergeben.
Fremde Triggerfunktionen/Views, die hier nur referenziert werden, benoetigen
gegebenenfalls einen gesondert begrenzten Metadatenabgleich; dieser Report
beweist ihre Semantik nicht.

```sql
begin transaction read only;

select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in ('anfragen','sessions','invoices','blocked_slots',
    'appointment_proposals','anfrage_health_data_consents',
    'request_conversations','request_messages','request_message_events')
order by tablename, policyname;

select c.relname, t.tgname, t.tgenabled,
       pg_catalog.pg_get_triggerdef(t.oid, true) as definition,
       p.oid::regprocedure::text as trigger_function
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_proc p on p.oid = t.tgfoid
where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
  and c.relname in ('anfragen','sessions','invoices','blocked_slots',
    'appointment_proposals','request_conversations','request_messages')
order by c.relname, t.tgname;

select conrelid::regclass::text as child_relation, conname,
       pg_catalog.pg_get_constraintdef(oid, true) as definition
from pg_catalog.pg_constraint
where conrelid in (
  select oid from pg_catalog.pg_class
  where relnamespace = 'public'::regnamespace
    and relname in ('anfragen','team_members','sessions','invoices',
      'blocked_slots','appointment_proposals','anfrage_health_data_consents',
      'request_conversations','request_messages'))
order by child_relation, conname;

select r.rolname, r.rolsuper, r.rolbypassrls,
       parent.rolname as member_of_role
from pg_catalog.pg_roles r
left join pg_catalog.pg_auth_members m on m.member = r.oid
left join pg_catalog.pg_roles parent on parent.oid = m.roleid
where r.rolname in ('anon','authenticated','service_role')
order by r.rolname, parent.rolname;

with targets(name) as (
  values ('team_members'), ('anfragen'), ('sessions'), ('invoices'),
         ('blocked_slots'), ('appointment_proposals'),
         ('anfrage_health_data_consents'), ('request_conversations'),
         ('request_messages'), ('request_message_events')
), roles(name) as (values ('anon'), ('authenticated'), ('service_role'))
select t.name as table_name, r.name as role_name,
       case when to_regclass('public.' || t.name) is not null
         then has_table_privilege(r.name, 'public.' || t.name, 'SELECT') end as can_select,
       case when to_regclass('public.' || t.name) is not null
         then has_table_privilege(r.name, 'public.' || t.name, 'INSERT') end as can_insert,
       case when to_regclass('public.' || t.name) is not null
         then has_table_privilege(r.name, 'public.' || t.name, 'UPDATE') end as can_update,
       case when to_regclass('public.' || t.name) is not null
         then has_table_privilege(r.name, 'public.' || t.name, 'DELETE') end as can_delete,
       case when to_regclass('public.' || t.name) is not null
         then has_any_column_privilege(r.name, 'public.' || t.name, 'INSERT') end as any_column_insert
from targets t cross join roles r
order by t.name, r.name;

rollback;
```

**Abbruchbedingungen:**

- Falsches/unbestaetigtes Projekt, fehlende Katalogsicht oder Basistabelle,
  fehlende Rollen/Funktionen, Typ-/Constraintabweichung ohne Freigabe.
- Eine der Policies `coaches read own request conversations` bzw.
  `coaches read own request messages` fehlt oder hat abweichende Semantik.
  Sie werden vom Kandidaten ohne `IF EXISTS` entfernt.
- Neue Spalten/Tabellen/Index/Funktionssignaturen oder gleichnamige neue
  `privacy_`-Trigger bereits vorhanden: bisherigen Zustand zuerst klaeren.
- Browserrollen haben wieder Session-INSERT oder RLS ist dort aus.
  Hotfix nicht veraendern; Metadatenabweichung melden.
- Backend benoetigte Rechte fehlen, unerwartete Rollenvererbung/weitere
  Policies/Views oder Triggersemantik bleiben ungeklaert.
- Produktive App-/Worker-Version ist unbekannt, alt oder nicht identisch
  mit dem abgenommenen P0-Paket; Bestands-Consent-/Messaging-Betriebsgrenzen
  oder kontrollierte Unterbrechung sind nicht akzeptiert.

## 4. Code-/DB-Reihenfolge und Sicherung

1. **Jetzt nur Vorpruefung:** Nutzer bestaetigt deployed Commit/Build-ID,
   zugehoerigen Quellstand inkl. Worker/Crons und beide Katalogreports.
   Kein DDL, kein Deployment und keine Produktivaktion durch den Agenten.
2. Vor weiterer Freigabe ein eindeutig versioniertes, vollstaendiges
   P0-Codepaket festlegen. Produktiven Stand dagegen offline vergleichen,
   inkl. Formular, Coach/Admin, Billing, Buchung, Messaging und Loeschroute.
   Der vorhandene HEAD allein enthaelt nicht alle lokalen Aenderungen.
3. Backup-/PITR-Status und Wiederherstellung menschlich bestaetigen; interne
   Sicherung der DDL/ACLs/Policies/Trigger/RPC-Signaturen und der letzten
   Codeversion mit Zeitpunkt/Owner/Dateihashes. Kein Datenbankdump hier.
   Ein Restore muss den bereits geschlossenen Session-Hotfix erhalten;
   nicht auf einen ungesicherten Zustand vor dessen Anwendung zuruecksetzen.
4. **Separat freizugebendes Wartungsfenster:** Requests/Worker/Crons/
   Webhooks kontrolliert anhalten und laufende Transaktionen abschliessen.
   Keine automatische Freigabe unklarer Providerclaims. Kein produktiver
   Traffic durch einen halb migrierten Code-/DB-Zustand.
5. Unter aufrechterhaltener Wartung zuerst die Zugriffsmigration anwenden,
   dann Katalog-Nachkontrolle. Die neue App zuerst livezuschalten scheitert
   ohne neue Spalten/RPCs fail-closed; alte App nach DB-Wechsel ist ebenfalls
   nicht kompatibel (direkte Ownerwrites, Browserreads, Nachrichtenwrites).
6. Passendes P0-App-/Worker-Paket unter Wartung bereitstellen. Weil die
   lokale Loeschroute einen separaten RPC verlangt, entweder die
   Loeschmigration **zusaetzlich und getrennt freigeben** oder Endloeschung
   bis dahin explizit gesperrt lassen. Kein Fallback auf Parent-DELETE.
7. Erst nach unten definierter Abnahme Traffic schrittweise freigeben.
   Betriebsfreigabe fuer pausiertes Inhalts-Messaging erforderlich.
   Historische Gesundheitszugriffe ohne Empfaengerfreigabe nicht durch
   Backfill oder Widerrufsausnahme wiederherstellen.

Die Transaktion der Zugriffsmigration verhindert Teil-DDL, benoetigt aber
Tabellenlocks. Laufzeit/Lockwartezeiten und produktive Last sind unbekannt:
kein Versprechen fuer Zero-Downtime. Wartungsfenster/Timeoutkonzept vor
Ausfuehrung festlegen. Die Schritte 2-7 sind vorbereitet, nicht genehmigt.

## 5. Exaktes Migrations-SQL bleibt gesperrt

Keine Copy/Paste-Ausfuehrungsfassung jetzt: Voraussetzungen sind unbestaetigt.
Nach Auswertung der Reports und Codeabgleich wird die unveraenderte,
isoliert getestete
[Quelldatei](../supabase/migrations/20261028000000_privacy_phase1_access.sql)
mit Dateihash zur gesonderten Freigabe benannt. Erst dann den vollstaendigen
Inhalt von `BEGIN` bis `COMMIT` in einem Schritt verwenden; keine Auszuege.
Erforderliche Korrekturen am Kandidaten verlangen erneute lokale Abnahme.
Keine automatische Wiederholung und keine Migrationshistorien-Reparatur.

## 6. Nachpruefung und Funktionstests (erst spaeter freizugeben)

Nach DDL-Commit Metadatenreports A/B und freigegebenen Katalog-Preflight
erneut auswerten, ohne Anwendungszeilen:

- Alle acht hinzugefuegten Spalten mit erwarteten Typen, vier Care-Tabellen
  mit RLS, `RESTRICT`-FKs und Unique-Index fuer eine offene Periode.
- Alle Kandidaten-RPCs mit exakten Signaturen und vorgesehenem Owner/
  search_path/EXECUTE. Nur `privacy_coach_can_read(uuid)` fuer authenticated;
  Server-RPCs nicht fuer Browser/PUBLIC. SECURITY-DEFINER-Owner und effektive
  RLS-Wirkung gesondert bestaetigen; kein pauschales Owner-Rollenmapping.
- Neue Guard-/Initialisierungs-/Childtrigger aktiv, zwei alte Messaging-
  Policies entfernt und neue Policies vorhanden; keine andere Policy hebt
  Rechte-/RLS-Grenzen auf. Tabellen-/Spaltengrants und vererbte Rechte fuer
  die fuenf gesperrten Basistabellen wirksam entzogen.
- Session-Hotfix weiterhin sieben positive Metadatenpruefungen laut
  [Hotfix-Runbook, Abschnitt 4](privacy-p0-manual-rollout.md#4-erfolgskontrolle-nur-kataloge-kein-test-insert-in-produktion).
- Keine Belege/Owner/Termin-/Finanzwerte automatisch backfillen oder
  fuer Abnahme veraendern; keine Test-RPCs/INSERTs gegen Produktion.

**Positive/negative Funktionstests zuerst isoliert mit synthetischen Daten
und Providermocks:** Admin/aktueller/fremder Coach, vor/nach Widerruf,
erforderliche frische Empfaengerfreigabe; Handover A->B->A mit historischer
Session und ohne Aenderung historischer Owner; konkrete Zukunftstermine/
Claims blockieren Wechsel; Einzel-/Batch-/Tokenbuchung und Versionen;
historische Rechnungsansicht, Invoice-Save und Session-Delete mit neuer
Actor-/Ownerpruefung; Messagingread/-write/Inbound/Retry bleiben gesperrt.
Die [Abnahmesuite](privacy-p0-acceptance.md) bestand synthetisch; neue
Datenbankausfuehrung braucht gesonderte Freigabe.

Produktive UI-/API-Funktionsabnahme ist **nicht** durch Katalogchecks ersetzt.
Sie benoetigt einen eigens genehmigten, datensparsamen Ablauf durch den
Betreiber. Keine echten Buchungen, Mails, Rechnungserstellung, Coachwechsel
oder sevDesk-Aktionen allein zur Probe. Bis zu deren Freigabe darf die
vollstaendige produktive End-to-End-Abnahme nicht als bestanden gelten.

## 7. Fehler und Wiederherstellung

- Fehler vor Commit: gesamte Transaktion zurueckrollen, Ausgang pruefen;
  kein Fortsetzen mit einzelnen Statements. Session-Hotfix bleibt bestehen.
- Fehler nach Commit: Wartung beibehalten, keinen alten unsicheren Code
  live zurueckrollen und keine Browsergrants/Altpolicies wieder erteilen.
  Zweckgebundenen Forward-Fix mit gesonderter Freigabe vorbereiten.
- Nach Wiederaufnahme koennen neue Care-/Consent-/Operationsdaten entstanden
  sein. Keine Tabellen droppen, keine Spalten entfernen und keine Owner/
  Consents zurueckschreiben. Keine automatische Rueckmigration.
- Katastrophen-Restore nur separat geplant/freigegeben; zwischenzeitliche
  externe Kalender-/Mail-/Rechnungsaktionen sind nicht durch DB-Restore
  rueckgaengig. Bereits produktiven Session-Hotfix gesondert erhalten.

**Naechster konkreter Schritt:** Nutzer fuehrt ausschliesslich die
read-only Vorpruefungen A/B manuell aus, bestaetigt das Projekt intern und
nennt den produktiv bereitgestellten Commit/Build samt zugehoerigem
Quellstand. Nur bereinigte Befunde weitergeben. Danach folgt eine neue
Freigabeentscheidung; jetzt kein Migrations-SQL ausfuehren.

## 8. Neues Systemwissen

- Session-Hotfix produktiv laut Nutzer auf Berechtigungsebene bestaetigt;
  Migrationshistorie und End-to-End-Abnahme sind davon getrennt.
- Zugriffsmigration und App sind ein koordiniertes Paket, keine belegte
  Live-Expand/Contract-Migration. Ein Wartungsfenster ist vorzusehen.
- Re-Engagement/Recovery sind keine direkten DDL-Voraussetzungen dieser
  einzelnen Migration, aber fuer Gesamt-App und Loeschrollout relevant.
- Der Zeitpunkt des manuell angewendeten Hotfixes liegt hinter den noch
  ausstehenden Kandidaten in der Dateisortierung. Dateireihenfolge allein
  ist weder Nachweis des Produktivzustands noch Freigabe zum CLI-Push.
