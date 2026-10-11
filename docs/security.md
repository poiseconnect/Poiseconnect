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