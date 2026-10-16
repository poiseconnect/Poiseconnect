# Sicherheits- und Datenschutzkonzept

## Geltungsbereich

Dieses Dokument beschreibt die Sicherheitsregeln für:

- das private GitHub-Repository,
- technische Projektdokumentation,
- zukünftige KI-Suchfunktionen,
- Entwicklungs- und Deployment-Prozesse.

Es ersetzt keine individuelle juristische Datenschutzprüfung.

## Grundsatz

KI-Systeme erhalten nur Zugriff auf technische Informationen,
die für Softwareentwicklung, Dokumentation und Fehlersuche
erforderlich sind.

Produktionsdaten von Klientinnen und Klienten werden nicht
in einen KI-Suchindex übernommen.

`/api/image-proxy` lädt ausschließlich HTTPS-Bilder von den freigegebenen
WordPress-Bildhosts `mypoise.de` und `www.mypoise.de`. DNS-Antworten werden
vor dem Verbindungsaufbau auf öffentliche IP-Adressen geprüft und die geprüfte
Adresse für die TLS-Verbindung fest gebunden. Jeder Redirect durchläuft dieselbe
Prüfung; zurückgegeben werden nur unterstützte Rasterbilder mit passendem
Dateisignatur- und MIME-Typ.

## Zulässige Inhalte

- Quellcode
- Dateipfade
- API-Routen
- Tabellennamen
- Spaltennamen
- technische Datenflüsse
- Statusmodelle
- technische Architekturentscheidungen
- datensatzfreie SQL-Migrationen
- anonymisierte Fehlertypen
- künstliche Testdaten

## Unzulässige Inhalte

- Produktionsdatenbank-Dumps
- Klientenprofile
- Gesundheitsangaben
- echte Namen
- echte E-Mail-Adressen
- echte Telefonnummern
- echte Anschriften
- Geburtsdaten
- Support-E-Mails mit Personendaten
- Kalendertermine mit realen Klientennamen
- Booking-Tokens
- API-Schlüssel
- Passwörter
- Supabase-Service-Role-Keys
- OAuth-Access- oder Refresh-Tokens
- Resend-Schlüssel
- Meeting-Links mit vertraulichem Zugriff

## Zugriffskontrolle

- Repository bleibt privat.
- Zugriff wird nach dem Least-Privilege-Prinzip vergeben.
- KI-Zugriff beginnt read-only.
- Kein direkter KI-Zugriff auf die Produktionsdatenbank.
- Kein direkter KI-Push auf den produktiven Branch.
- Kein automatisches Deployment durch KI.
- Kein automatisches Ausführen von SQL in Produktion.

## SevDesk-API-Routen

Die nicht authentifizierten Routen `/api/sevdesk/create-provision-invoice`
und `/api/sevdesk/test-invoice` wurden entfernt. Sie konnten mit serverseitigen
sevDesk-Zugangsdaten externe Rechnungsaktionen auslösen. Zum Zeitpunkt der
Entfernung gab es keine Aufrufer im Repository und keine dokumentierte oder
konfigurierte interne Verwendung. Neue SevDesk-Aktionen müssen authentifiziert
und autorisiert sein und Rechnungsdaten serverseitig aus vertrauenswürdigen
Quellen laden.

`/api/sevdesk/create-and-send-coach-invoice` ist nur für aktive Admins
erreichbar und erstellt aus einem gespeicherten `coach_invoices`-Draft
ausschließlich einen sevDesk-Entwurf (Status `100`). Trotz des historischen
Pfadnamens gibt es keine Versand- oder Finalisierungsoperation. Der GET-Aufruf
liest ausschließlich `/Invoice/{id}` und schreibt keinen externen oder lokalen
Status zurück. Eine vorläufige sevDesk-Entwurfsnummer wird nicht als endgültig
behandelt.

Vor Erstellung ist eine aktuelle Coach-Quartalsfreigabe erforderlich. Ihre
Version bindet den relevanten Sitzungs-/Steuerdatenstand; Datenbanktrigger
entwerten sie bei Änderungen. Eine atomare Reservierung prüft Snapshot,
Freigabeversion und Draft-Zeitstempel, bevor der sevDesk-Schreibaufruf erfolgt.
Eine transaktionsgebundene Coach-Sperre wird durch Reservierung, Freigabe und
BEFORE-Trigger auf allen abrechnungsrelevanten Quelltabellen geteilt. Dadurch
werden auch direkte Datenbankupdates und Importe entweder vor der Reservierung
vollständig berücksichtigt oder während einer laufenden Erstellung abgewiesen.
Die Sperre wird vor dem externen HTTP-Aufruf committet; eine Datenbanktransaktion
bleibt nicht ueber den sevDesk-Aufruf offen. Ein Datenbanktrigger verhindert
zusaetzlich Aenderungen oder Loeschung des reservierten Rechnungsentwurfs.

Ein Unique Index sichert je Coach, Quartal und bestehendem Steuer-Bundle
(`reverse_charge`/`normal_ust`) genau einen lokalen Rechnungsdraft. Die beiden
Bundles bleiben getrennte Rechnungen. Historische Duplikate werden nicht
automatisch bereinigt; die Migration stoppt vor Indexanlage und benoetigt
manuelle Konfliktpruefung. Admin-Save und Neuberechnung verwenden
`updated_at` als Compare-and-Swap; parallele Bearbeitungen fuehren zu einem
sichtbaren Konflikt statt zu einem stillen Ueberschreiben.

Sitzungen ohne gueltigen positiven Preis bleiben in der Berechnung sichtbar,
werden mit Sitzungs-ID gemeldet und blockieren Draft-Speicherung,
Neuberechnung und sevDesk-Erstellung. Bei Timeout oder unklarem externem Ergebnis bleibt `creation_unknown` gesperrt;
der Vorgang wird nicht automatisch wiederholt. HTTP 409 und 5xx sowie
Netzwerkfehler bleiben unklar und erfordern manuelle Pruefung; auch HTTP
400/401 loesen keine automatische Ruecksetzung oder Wiederholung aus.
Vor einem POST liest der Server die Rechnungen des Coach-Kontakts und
deren Positionen. Ein vorhandenes gleiches Bundle oder ein nicht eindeutig
klassifizierbarer Quartalsfund blockiert fail-closed; das zweite bestehende
Bundle wird nur bei eindeutiger Positions-/Steuerzuordnung zugelassen. Der
Kontaktlistenabruf folgt sevDesks `limit`-/`offset`-Pagination mit maximal 1000
Einträgen pro Seite und liest bis zur letzten kurzen Seite. Ein unvollständiger
Listenabruf blockiert. Gespeicherte sevDesk-Drafts
sowie unklare Altzustände blockieren Speichern und manuelle Synchronisierung,
damit Änderungen nach der Erstellung nicht automatisch in sevDesk geschrieben
werden. Beide bisherigen manuellen Schreib-Syncs sind unabhaengig vom Status
serverseitig stillgelegt (HTTP 409); GET-Status und PDF bleiben verfuegbar.

Die additive Migration `20261012000000_coach_invoice_link_guards.sql`
quarantiniert die bekannten zwei historischen ID-Konfliktgruppen ohne
Rechnungsdaten zu veraendern. Auch sonstige Mehrfachzuordnungen werden vor
Save, Neuberechnung und Erstellung geprueft; Fehler/fehlende RPC sperren
fail-closed. Ein BEFORE-Trigger schuetzt direkte DB-Schreibwege. Neue IDs
werden nur bei reservierter Erstellung angenommen und in einer separaten,
RLS-geschuetzten Claim-Tabelle mit eindeutiger externer und lokaler ID
transaktionssicher gebunden. Historische Links werden nicht automatisch
zurueckgefuellt, getrennt oder geloescht. Ein Unique Index auf allen alten
externen IDs ist erst nach separater Bestandsbereinigung zu entscheiden.
Gewoehnliche Saves koennen keine ID setzen, austauschen oder entfernen.
Bereits verknuepfte und creation_unknown-Rechnungen sind schreibgeschuetzt.
Bekannte Provider-IDs nach Persistenzfehlern dienen ausschliesslich als
Wiederherstellungsmetadaten, nicht als automatische Verknuepfung.

Der Server verlangt zusaetzlich `SEVDESK_COACH_INVOICE_TEST_COACH_ID` und
verweigert Neuanlagen fuer jeden anderen Coach, auch wenn das Frontend einen
Button zeigt. Ohne diese Variable bleibt der Livepfad geschlossen. Logs
enthalten nur Request-ID, Phase, Provider-Status und Fehlercode, keine Tokens,
Rechnungs-/Request-Inhalte oder Coach-Kontaktdaten.

Die additive Migration `20261009000000_coach_quarter_release.sql` erstellt
Snapshot-/Reservierungslogik; `20261011000000_coach_invoice_creation_guards.sql`
ergänzt gemeinsame Sperren, Quellschreibschutz und lokalen Duplikatschutz.
Beide müssen nach Schema- und Konfliktprüfung kontrolliert angewendet werden;
sie wurden nicht auf Produktion oder Supabase angewendet. Ein lokaler,
wegwerfbarer PostgreSQL-15-Test mit synthetischem Basisschema hat die
Migrationen, Sperrtrigger und parallele RPC-Reservierung ausgeführt, ersetzt
aber keine Prüfung des konkreten Zielschemas. Auch der
Anwendungsstand der älteren Statusmigration ist nicht verifiziert. Der
Livepfad benötigt bestätigte Account-Steuer-/Kontaktzuordnungen,
API-Schema-Version und den serverseitigen sevDesk-Token. Ein abweichendes
sevDesk-Layout wird nicht automatisch verhindert; vor manueller Finalisierung
muss das erstellte Dokument im Konto geprüft werden.

Rollout-Reihenfolge: (1) Zieltabellen, Rollen, Triggerabhaengigkeiten und
Duplicate-Preflight read-only pruefen; (2) Backup und Wiederherstellung bzw.
Forward-Fix festlegen; (3) Migrations- und Berechtigungstests sowie Gesamtbuild
abschliessen; (4) zunaechst Code mit deaktivierter Erstellung und stillgelegten
Schreib-Syncs ausrollen, danach 08/09/11/12 in der bestaetigten Reihenfolge
anwenden; im Zwischenzustand ist die Coach-Abrechnung absichtlich fail-closed
und ein kontrolliertes Wartungsfenster erforderlich; (5) nur
den expliziten Test-Coach freigeben; (6) Freigabe, Admin-Korrektur und einen
Status-100-Testentwurf pruefen; (7) Entwurf in sevDesk manuell kontrollieren,
Finalisierung und Versand dort manuell belassen; (8) erst nach dokumentierter
Abnahme Teamfreigabe separat beschliessen. Produktionsschema, Bestandsdaten,
Provider-Account und echte Parallelitaet sind durch lokale Mocktests nicht
verifiziert.

Vor vollstaendiger Migration 08/09/11/12 sperrt eine serverseitige, rein lesende
Bereitschaftspruefung alle neuen Schreibaktionen (Freigabe, Speichern,
Neuberechnung, sevDesk-Erstellung) mit 503 `coach_quarter_workflow_unavailable`.
Fehler der Pruefung gelten immer als nicht bereit (fail-closed); geloggt werden
nur Objektname und Grundcode (`schema_pending`/`check_failed`).

Der berechnete-Bundle-Endpunkt `/api/sevdesk-export-coach-quarterly` ist für
Nicht-Draft-Erstellung stillgelegt und antwortet authentifizierten Admins mit
HTTP 410. Die ungeschützte Test-Update-Route wurde entfernt.

## Coach-Rechnungen und UID-Bestätigung

Der private Rechnungsdaten-Leseendpunkt `/api/invoice-settings` erfordert einen
gültigen Bearer-Token und ein aktives Teammitglied. Coaches dürfen nur ihre
eigene `therapist_id` laden; aktive Admins dürfen die Einstellungen eines
existierenden Coaches laden. Schreibzugriffe bleiben über
`/api/accounting-settings` rollenbeschränkt und verwenden den eindeutigen
`therapist_id`-Upsert.

Coach-UIDs werden nicht durch ihre Eingabe als bestätigt behandelt. Nur aktive
Admins dürfen sie manuell über `/api/accounting-settings/confirm-uid`
bestätigen. Änderungen an `vat_number` oder `business_country_code` löschen
`uid_confirmed_at` und `uid_confirmed_by` datenbankseitig.

Poise→Coach-Rechnungen bleiben bearbeitbare Entwürfe. Die automatische
Sessionberechnung darf einen gespeicherten Entwurf nur nach einer ausdrücklichen
Admin-Aktion überschreiben. `review_required` blockiert steuerlich relevante
Weiterverarbeitung. PDF- und sevDesk-Ausgabe müssen in einem späteren Schritt
den bewusst gespeicherten Rechnungsstand verwenden.

## Entwicklungsprozess

1. Änderung auf einem separaten Branch.
2. Lokale Syntax- und Buildprüfung.
3. Menschliche Kontrolle der Änderung.
4. Vercel Preview Deployment.
5. Funktionstest mit künstlichen Daten.
6. Pull Request.
7. Kontrollierter Merge in den produktiven Branch.
8. Produktives Deployment beobachten.
9. Rollback-Möglichkeit bereithalten.

## Logging

Serverlogs dürfen keine vollständigen Request-Bodies mit
personenbezogenen Daten enthalten.

Zu entfernen oder zu maskieren sind insbesondere:

- E-Mail-Adressen
- Telefonnummern
- Anschriften
- Freitext-Anliegen
- Diagnosen
- Booking-Tokens
- OAuth-Tokens
- Meeting-Links

Zulässige technische Logwerte sind beispielsweise:

- Request-ID
- anonymisierte Datensatz-ID
- API-Routenname
- technischer Fehlercode
- HTTP-Status
- Dauer einer Anfrage

## Draft-Recovery-Consent

Der optionale Consent für genau eine spätere Draft-Fortsetzungs-Erinnerung ist
technisch getrennt von Datenschutz- und Newsletter-Feldern. Neue Datensätze
speichern bei ausdrücklicher Zustimmung einen serverseitigen Zeitpunkt und
eine stabile Consent-Version. Der eigentliche Text wird nicht pro Datensatz
dupliziert. Bestehende Drafts erhalten keinen impliziten Consent; ihr Status
bleibt für Recovery effektiv unbekannt bzw. nicht berechtigt. Versandstatus und
Funnel-Messung sind separate Konzepte. Der tägliche Cronjob `/api/reminders/send`
verarbeitet ausschließlich berechtigte Drafts (>48h inaktiv, Consent `true`,
bisher un-erinnert) und sendet eine strikt neutrale E-Mail ohne psychologische
Details oder Themen. Die Idempotenz wird sichergestellt, indem `draft_reminder_sent_at`
erst nach erfolgreichem Mailversand in UTC aktualisiert wird.

Der bestehende öffentliche Resume-Mechanismus lädt `anfragen` aktuell anhand
von `rid` beziehungsweise `anfrageId` und verwendet `select("*")`. Der
Endpunkt hat keine zusätzliche Token-Autorisierung. Wer eine gültige ID kennt,
kann daher potentiell auch sensible Felder laden. Eine Token-Lösung ist eine
separate sicherheitskritische Entscheidung und wurde in dieser Änderung nicht
umgesetzt.

## Testdaten

Tests verwenden ausschließlich künstliche Datensätze.

Beispiel:

- Name: Test Klient
- E-Mail: test@example.invalid
- Telefonnummer: 0000000000

Keine Produktionsdaten in Preview Deployments kopieren.

## Schlüsselverwaltung

Zugangsschlüssel werden ausschließlich als geschützte
Umgebungsvariablen verwaltet.

Sie dürfen nicht vorkommen in:

- Quellcode
- Markdown-Dateien
- Screenshots
- Issues
- Pull Requests
- Chat-Nachrichten
- Testdaten
- Logs

## Vorfall mit Zugangsdaten

Bei Verdacht auf einen geleakten Schlüssel:

1. betroffenen Schlüssel sofort widerrufen,
2. neuen Schlüssel erzeugen,
3. Vercel-Umgebungsvariable aktualisieren,
4. Git-Historie prüfen,
5. GitHub Secret Scanning prüfen,
6. Logs auf unbefugte Verwendung kontrollieren,
7. Auswirkungen dokumentieren,
8. datenschutzrechtliche Meldepflicht prüfen.

## Produktion

Das laufende Poise-System bleibt während der Einführung der
KI-Dokumentation unverändert.

Dokumentations- und Indexierungsfunktionen werden vom
Produktivsystem getrennt eingeführt.

### Verbindliche Prüfung vor einem Sicherheits-Rollout

Vor einer Produktionsfreigabe muss eine autorisierte Person:

1. den letzten erfolgreichen Supabase-Backup-Zeitpunkt und die
   Wiederherstellbarkeit in einer isolierten Umgebung mit synthetischen
   beziehungsweise anonymisierten Prüfdaten bestätigen; keine Produktions-
   Klientendaten in Entwicklungswerkzeuge oder diesen Review übernehmen,
2. den tatsächlich ausgelieferten Vercel-Commit/Build mit dem freizugebenden
   Commit vergleichen und ungeklärte Abweichungen stoppen,
3. anhand von Auth-/Audit-Metadaten und Request-Zeitpunkten prüfen, ob es
   Hinweise auf unbefugte Lese- oder Löschzugriffe gibt. Dafür nur
   datensparsame Metadaten (Zeitfenster, Route, Ergebnis, Actor-ID intern)
   verwenden; keine Request-Bodies, Namen, E-Mail-Adressen, Gesundheitsdaten,
   Booking-Tokens oder vollständigen Logs exportieren oder in Tickets
   dokumentieren,
4. gefundene Hinweise intern zu sichern, betroffene Credentials nötigenfalls
   zu widerrufen und Datenschutz-/Meldepflichten zu prüfen.

Diese Prüfung ist eine Rollout-Voraussetzung, keine automatische Aktion dieses
Codes. In diesem Entwicklungs-/Review-Schritt wurden weder die
Produktionsdatenbank noch Produktionslogs oder Klientendaten abgefragt; eine
Backup-Wiederherstellung wurde nicht ausgeführt.

## Staff-API-Berechtigungen

Staff-Routen prüfen einen gültigen Bearer-Login und ein aktives
`team_members`-Profil. Admins behalten die bestehenden Admin-Aktionen;
Therapeut:innen behalten Statuswechsel, Terminbestätigung, Matching,
zugewiesene Klient:innenpflege, Vorschläge, Reschedule sowie Session-Anlage
und -Löschung für eigene Sitzungen. Datenzugriffe und Änderungen an
Klient:innenanfragen sind auf die aktuelle Coach-Zuordnung begrenzt. Die
permanente Löschung einer Anfrage ist ausschließlich aktiven Admins erlaubt;
Session-Löschung ist eine getrennte, für eigene Sitzungen erlaubte Operation.

## Klient:innen: Legacy-Links und E-Mail-Wiederherstellung

`GET /api/public-request` verlangt ID **und aktuellen** `booking_token`.
`POST /api/proposals/resolve-legacy-link` ist als tokenausgebender ID-Resolver
stillgelegt und antwortet ohne Datenbankzugriff mit `RECOVERY_REQUIRED`.
Bestehende Datensätze können über `create-request-draft` und `form-submit`
nur mit dem aktuellen Booking-Token gelesen/aktualisiert werden; auch das
UPDATE selbst ist nach Token gefiltert (Schutz gegen parallelen Tokenwechsel).
Dies schützt insbesondere die gespeicherte Empfängeradresse vor ID-only-
Überschreiben. Neue öffentliche Drafts und neue vollständige Anfragen bleiben
ohne vorhandenen Token möglich.

Alte `rid`-/`anfrageId`-Resume-Links sowie Proposal-Links mit `request` oder
historischem Timestamp `id` zeigen stattdessen ein E-Mail-Eingabefeld.
Auch ungültige tokenisierte Resume-/Proposal-Links bieten Wiederherstellung.
Die Eingabe wird mit der **servergespeicherten** Adresse abgeglichen; versendet
wird nur an diese Adresse, nie an ein frei übergebenes `to`. Historische
E-Mail-only-Links werden nur bei genau einer passenden, nicht beendeten/
gelöschten Anfrage aufgelöst. Timestamp-Links unterstützen beide historischen
Proposal-Spaltenpaare (`request_id`/`proposed_at`, `anfrage_id`/`date`); ist der
alte Vorschlag bereits gelöscht, gilt ebenfalls die eindeutige E-Mail-Zuordnung.
Mehrdeutigkeit erfordert Support. Keine Adresse, Datensatzexistenz, Buchungs-
oder Recovery-Credentials werden in der Anforderungsantwort bestätigt:
`POST /api/client-link-recovery/request` antwortet nach erfolgreichem Queue-
Insert oder Ratenlimit generisch mit HTTP 202. Bei fehlender Migration oder
einem Queue-/Konfigurationsfehler antwortet sie mit einem ebenfalls generischen
HTTP 503, damit keine erfolgreiche Einreihung vorgetäuscht wird. Beide
Antworten sind unabhängig von der Recovery-Berechtigung. Die öffentliche Route
führt ausschließlich Formatprüfung und einen atomaren, persistenten,
rate-limitierten Outbox-Insert aus. Sie fragt nicht ab, ob Anfrage oder E-Mail
existieren, und wartet nie auf den Mailprovider. Dadurch hängt ihre
Antwortzeit nicht von der Recovery-Berechtigung ab.

`/api/cron/client-link-recovery` verarbeitet die Outbox höchstens in kleinen
atomar beanspruchten Batches. Der Worker verlangt `CRON_SECRET` zwingend und
antwortet ohne Konfiguration fail-closed; Vercel ruft ihn minütlich auf.
Providerfehler werden mit gedeckeltem exponentiellem Backoff erneut versucht.
Ein stabiler Resend-Idempotency-Key verhindert Doppelzustellungen bei
unklarem Provider-Ergebnis oder fehlgeschlagener Queue-Bestätigung. Jobs
bleiben bis zum Provider-Erfolg oder einer eindeutigen Nichtberechtigung
persistiert; sie werden nicht nach einer festen Versuchszahl verworfen.

Die Queue-Tabelle ist RLS-geschützt und nur für `service_role` freigegeben.
Der zufällige Recovery-Code liegt dort ausschließlich AES-256-GCM-verschlüsselt
vor; der Schlüssel wird aus dem bestehenden `SUPABASE_SERVICE_ROLE_KEY`
abgeleitet. E-Mail-Adresse, Zweck und Zuordnungsangaben bleiben bis zum
Abschluss als notwendige Outbox-Daten gespeichert und werden nach `sent` oder
`no_match` entfernt. Eine Rotation des Service-Role-Keys darf nicht erfolgen,
solange Jobs offen sind, da andernfalls deren verschlüsselte Codes nicht mehr
entschlüsselt werden können.

Die neutrale Textmail enthält einen zufälligen 256-Bit-Recovery-Code im
URL-Fragment, nicht den Booking-Token oder personenbezogene Anfrageinhalte.
`/recover-link` entfernt das Fragment aus der Adresszeile und verlangt einen
bewussten POST zur Einlösung (GET/Linkscanner verbrauchen den Zugang nicht).
Erst nach erfolgreicher Einlösung erfolgt ein 303-Redirect auf ein festes,
serverseitig konstruiertes Ziel: Draft-Fortsetzung mit gespeichertem Schritt
0–11 (Fallback 8), Coach-Auswahl Schritt 8, Terminwahl Schritt 10 oder
`/confirm-proposal`. Kein frei wählbarer Redirect wird übernommen.
Der Redirect enthält dann bewusst den autorisierten Booking-Token; die
Anforderungsantwort enthält keinerlei Zugang. Ein ungültiger/verbrauchter
Recovery-Code führt zurück zur Eingabemaske.

**Rollout-Voraussetzung, nicht ausgeführt:** Die additive Migration
`supabase/migrations/20261016000000_client_link_recovery.sql` muss nach
Schema-/Rollenprüfung separat freigegeben und angewendet werden. Sie benötigt
`anfragen.id` als UUID, `booking_token`, `email`, `status`,
`draft_current_step` (Draft-Foundation-Migration vom 10.09.2026) und
`appointment_proposals`. Neue RLS-geschützte Tabellen speichern gehashte
Recovery-Codes, Empfängerbindung, Token-Fingerprint, Zweck, Ablauf/Verbrauch,
die verschlüsselte Outbox-Nutzlast und gehashte Ratenlimit-Schlüssel. Nur
`service_role` darf Tabellen/RPCs verwenden. Zeilen-/UPSERT-Sperren sichern
einmalige Einlösung, 15 Minuten Gültigkeit, maximal 3 Anforderungen je
Adresse/Stunde und 10 je vertrauenswürdigem Vercel-Quell-IP-Schlüssel/Stunde
sowie 60 Sekunden je Anfrage.
Ohne vertrauenswürdigen `x-vercel-forwarded-for` teilen sich Aufrufer
konservativ ein gemeinsames Quelllimit. Datensatzadresse, Status und aktueller
Token werden bei Einlösung erneut geprüft. Bei wirklich alten NULL-Tokens
wird erst nach E-Mail-Nachweis ein Token initialisiert; bestehende Tokens
werden nicht rotiert. Abgelaufene Codes und Limit-Buckets werden bei neuen
berechtigten Anforderungen nach einem Tag bereinigt.

Für den Versand sind vorhandene Resend-Zugangsdaten und eine feste HTTPS-
`NEXT_PUBLIC_SITE_URL` nötig. Vor Rollout Link-/Klicktracking beim Mailprovider
für Credential-Mails deaktivieren bzw. verifizieren; Code verändert keine
Provider-/Vercel-Einstellungen. `Referrer-Policy: no-referrer`,
No-store-/Noindex-Header auf Credential-Seiten und das Entfernen vollständiger
Resume-/Draft-Logs reduzieren Leckage. Recovery-Codes werden weder geloggt
noch an Drittanbieter im Browser gesendet. Bestehende Booking-Tokens in alten
Query-/Pfad-URLs bleiben technisch in Infrastruktur-/Browserhistorien möglich;
entsprechende Infrastruktur-Logs müssen weiterhin redigiert werden.

Produzentenprüfung: `admin-forward`/`forward-request`, Draft-Erinnerungen,
`proposals/create`, Proposal-Crons und Booking-/Terminverwaltungslinks sind
bereits tokenisiert (NULL-Token-Fallbacks führen nun zur Recovery-UI).
`send-proposals` erzeugt nun Token- statt Timestamp-Links; ohne Token einen
`request`-Recovery-Link. `new-appointment` verwendet den gespeicherten Token
und versendet ausschließlich an die gespeicherte Adresse. Die historischen
`therapist-response`-GET-Aktionen führen keine Datenbank- oder Mailänderungen
mehr aus und leiten in das authentifizierte Dashboard; die externen
Link-Produzenten müssen vor Rollout auf einen authentifizierten
Dashboard-Workflow umgestellt werden. Bereits versandte Links auf
`mypoise.de` liegen außerhalb des App-Routings; dort ist gegebenenfalls ein
separat freizugebender Hinweis/Redirect auf `app.mypoise.de/recover-link` nötig.
Staff-Authentifizierung, Kalenderoperationen, `sessions`, `blocked_slots`,
Abrechnung und automatische Draft-Erinnerungs-Consent-Regeln werden durch
diesen Recovery-Pfad nicht verändert.

Validierung: fokussierte Vitest-Tests verwenden ausschließlich synthetische
Daten und gemockte Supabase-/Mail-/Kalenderaufrufe. Migration wurde nur
statisch auf Guards geprüft, **nicht ausgeführt**; Datenbank-Concurrency-/
Schema-Tests, Konfiguration und erfolgreicher Vercel-Cron-Aufruf sowie ein
kontrollierter Provider-Linktracking-Test bleiben Voraussetzung der
gesonderten Rollout-Freigabe.