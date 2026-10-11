# System-Audit-Workflow für Poise Connect

## Zweck

Dieser Audit-Workflow beschreibt den verbindlichen Prozess für einen systemweiten technischen Audit des Poise Connect-Repositories. Der Audit ist eine reine Analyse- und Dokumentationsaktivität. Er darf keine Anwendungscode-Änderungen, Refactorings, Datenbankmigrationen, Commits, Merges oder Deployments selbstständig durchführen.

## Geltungsbereich

Der System-Audit prüft technische Risiken und Inkonsistenzen in folgenden Bereichen:
- Architektur
- Codequalität
- Datenbank
- APIs
- Kalender
- E-Mail
- Abrechnung
- Security & Datenschutz
- Tests

## Audit-Prinzipien

- Der Audit ist strikt read-only.
- Keine Änderungen am Anwendungscode, an der Datenbank, an Branches oder Deployments ohne ausdrückliche menschliche Freigabe.
- Befunde werden dokumentiert, priorisiert und als Empfehlungen ausgegeben.
- Jede Feststellung enthält Beleg, Auswirkung und Handlungsempfehlung.
- Audits nutzen vorhandene Dokumentation und automatisierte Projektübersichten, wenn vorhanden.
- Neue Architekturentscheidungen oder verbindliche Regeln werden nicht eigenständig festgelegt. Wenn ein Auditpunkt eine Entscheidung erfordert, wird nur ein Vorschlag formuliert und mit `ENTSCHEIDUNG ERFORDERLICH` markiert.

## Quellen

Bei Audit-Aufträgen werden mindestens diese Quellen geprüft:
- `AI_CONTEXT.md`
- `docs/architecture.md`
- `docs/security.md`
- `docs/agent/cto-workflow.md`
- `.github/copilot-instructions.md`
- `docs/generated/` (generierte Projekt-Mappings)
- `scripts/generate-project-map.mjs` (Projekt-Mapping-Generator)

## Audit-Ablauf

### 1. Vorbereitung

Prüfpunkte:
- Ziel des Audits verstehen (z. B. Codequalität, Infrastruktur, Abrechnungslogik).
- Relevante Dokumente und generierte Projektansichten sammeln.
- Bestehende Audit- oder Review-Regeln identifizieren.
- Scope festlegen: gesamtes Repository oder spezifische Subsysteme.

### 2. Architektur-Analyse

Prüfpunkte:
- doppelte Geschäftslogik
- widersprüchliche Architektur
- unklare Source of Truth
- unnötige Parallelstrukturen
- stark gekoppelte Komponenten
- vorhandene Entwicklerdokumentation und Architekturdiagramme

### 3. Codequalität-Analyse

Prüfpunkte:
- ungenutzte Dateien
- ungenutzte Funktionen
- doppelte Funktionen
- große oder schwer wartbare Dateien
- `TODO` / `FIXME`-Marker
- inkonsistente Fehlerbehandlung
- unklare oder fehleranfällige Kontrollpfade

### 4. Datenbank-Analyse

Prüfpunkte:
- Tabellenverwendung und Datenmodell
- mögliche doppelte Datenquellen
- unsichere `single()` / `maybeSingle()`-Verwendung
- auffällige `update` / `delete`-Filter
- potenzielle Datenintegritätsprobleme
- Source of Truth für Abrechnung, Sessions, Blocked Slots

### 5. API-Analyse

Prüfpunkte:
- doppelte oder ähnliche API-Routen
- fehlende Eingabevalidierung
- mögliche doppelte Requests
- fehlende Idempotenz
- inkonsistente Fehlercodes
- fehlende Autorisierung oder Zugriffskontrolle

### 6. Kalender-Analyse

Prüfpunkte:
- Einhaltung der `POISE VERFÜGBAR`-Regel
- `blocked_slots`-Synchronisierung
- `sessions`-Synchronisierung
- Reschedule-Logik
- Zeitzonenprobleme
- Google Calendar API-Nutzung und Entkopplung

### 7. E-Mail-Analyse

Prüfpunkte:
- doppelte Sendemöglichkeiten
- Token-Handling
- personenbezogene Logs
- fehlende Fehlerbehandlung
- Mail-Integrations-Workflow

### 8. Abrechnungs-Analyse

Prüfpunkte:
- Source of Truth für Rechnungen
- Invoice-Persistenz
- Verwendung von `sessions` in der Abrechnung
- mögliche Inkonsistenzen bei Preis / Provision / Payout
- Trennung von Abrechnung und Kalenderlogik

### 9. Security & Datenschutz-Analyse

Prüfpunkte:
- Secrets im Code
- Service-Role-Key im Client
- personenbezogene Logs
- sensible Request-Bodies
- unsichere öffentliche Endpunkte
- Einhaltung der Datenschutzregeln aus `docs/security.md`

### 10. Test-Analyse

Prüfpunkte:
- vorhandene Tests
- besonders kritische ungetestete Workflows
- empfohlene Testprioritäten
- Testabdeckung für API-, Kalender-, Abrechnungs- und Sicherheitslogik

### 11. Findings dokumentieren

Für jedes Finding dokumentieren:
- Schweregrad: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFORMATIONAL`
- Problem
- Beleg aus dem Repository
- betroffene Dateien
- betroffene APIs
- betroffene Tabellen
- mögliche Auswirkungen
- Empfehlung
- geschätzter Aufwand
- Entscheidung erforderlich: ja/nein

### 12. Priorisierte Maßnahmen

Ergebnisliste in vier Kategorien:
- Sofort prüfen
- Als Nächstes verbessern
- Später sinnvoll
- Nur beobachten

### 13. Abschluss und Übergabe

- Audit-Ergebnisse klar dokumentieren
- Maßnahmen priorisieren
- Keine Änderungen ohne menschliche Freigabe ausführen
- Audit in `docs/agent/system-audit.md` und `docs/agent/cto-workflow.md` verankern

## Audit-Auswertung

Der System-Audit ist kein Coding-Task. Er liefert eine strukturierte Dokumentation und Entscheidungsgrundlage für nachfolgende Umsetzungsschritte.

## Wissens- und Lerntransfer

Nach jeder abgeschlossenen technischen Aufgabe und nach jedem System-Audit prüft der CTO-Agent, ob neues, allgemein relevantes und verifiziertes Systemwissen entstanden ist. Der Agent dokumentiert dabei insbesondere:

- Source-of-Truth-Regeln
- wichtige Datenflüsse
- Architekturzusammenhänge
- wiederkehrende technische Besonderheiten
- bestätigte technische Risiken
- relevante Technical Debt
- wichtige Entscheidungen und deren Begründung

Nicht dauerhaft dokumentiert werden:

- einmalige Implementierungsdetails
- Vermutungen oder unbestätigte Hypothesen
- personenbezogene Daten, Produktionsdaten, Secrets, echte Tokens oder vertrauliche Inhalte

Der Agent prüft, ob bestehende Dokumente aktualisiert werden sollten, insbesondere:

- `AI_CONTEXT.md`
- `docs/architecture.md`
- `docs/security.md`
- relevante Agenten-Dokumentation (z. B. `docs/agent/*`)
- relevante generierte Maps unter `docs/generated/`

Wichtig: Der Agent darf keine neue verbindliche Architekturregel oder Entscheidung eigenständig festlegen. Wenn das neu gewonnene Wissen eine Entscheidung oder neue Regel erfordert, erstellt der Agent nur einen Vorschlag mit Begründung und kennzeichnet das Ergebnis mit: `ENTSCHEIDUNG ERFORDERLICH`.

Jeder CTO-Abschlussbericht (siehe `docs/agent/cto-workflow.md`) muss einen Abschnitt `## Neues Systemwissen` enthalten mit folgenden Punkten:

- Was wurde gelernt?
- Ist es allgemein relevant?
- Ist es bereits dokumentiert?
- Welche Dokumentation ist betroffen?
- Wurde sie aktualisiert oder ist eine Entscheidung erforderlich?

Bei Updates an bestehender Dokumentation dokumentiert der Agent die durchgeführten Änderungen, die Quellen der Verifikation und die verantwortliche Person, die das Update vorgenommen hat.

### Verifiziertes Systemwissen: sevDesk-Draft-Sync (2026-10-02)

GitHub Copilot hat im freigegebenen lokalen Implementierungsauftrag den
bestehenden Draft-Sync um Leistungszeitraum und Quartalsreferenz erweitert.
Quelle bleibt die via `coachInvoiceId` geladene `coach_invoices`-Zeile;
strukturierte Periodenfelder bestimmen die Grenzen, erkennbare widersprechende
`service_period`-Labels blockieren den Aufruf. Beide UI-Sync-Schritte verwenden
die frisch gespeicherte ID und lassen Fehler bis zur Oberflaeche durch.
Dieses allgemein relevante Verhalten und die API-Felder sind in
`docs/architecture.md` dokumentiert. Verifikation: offizielle sevDesk-
OpenAPI-Spezifikation, gemockte Route-/UI-Regressionen und bestehende
Draft-Tests; keine produktiven DB- oder sevDesk-Aufrufe. Die vollstaendige
Suite bestand mit 350 Tests. Next.js kompiliert, der lokale Gesamtbuild ist
wegen fehlender Supabase-Umgebungsvariablen nicht abgeschlossen.

Offen bleiben fehlende Atomaritaet des Zwei-Schritt-Syncs sowie der separat
beobachtete Kopftext-Sync-Fehler. Die Erweiterung bestaetigt keine Behebung
dieses Fehlers und veraendert keine Steuer-/Provisionsentscheidung.

### Verifiziertes Systemwissen: Poise→Coach sevDesk Create-and-send (2026-10-08)

Der Adminablauf erstellt eine Rechnung direkt aus dem gespeicherten
`coach_invoices`-Draft und verwendet sevDesks E-Mail-PDF-Versand. Reservierung,
Invoice-ID-, Nummern- und Versandstatus sind getrennte persistierte Schritte;
unklare Ergebnisse werden nicht automatisch wiederholt. Berechneter
Dashboard-Bundle-Export und ungeschützte Test-Update-Route sind stillgelegt.
Die neue Statusmigration ist nur vorgeschlagen, nicht angewendet. Konto-,
Steuer-, Kontakt-, Layout- und Payloadschema-Freigaben bleiben notwendige
serverseitige Live-Gates. Verifiziert mit künstlichen Supabase-/sevDesk-Mocks
und fokussierten Regressionstests; keine produktiven Schreibaufrufe.

### Lokale Hardening-Ergaenzung: Coach-Quartalsfreigabe (2026-10-11)

Die lokale Implementierung ergaenzt `20261011000000_coach_invoice_creation_guards.sql`
mit einem gemeinsamen transaktionsgebundenen Coach-Advisory-Lock fuer
Freigabe, Erstellungsreservierung und BEFORE-Trigger auf Sitzungen,
Anfragen-/Abrechnungsfeldern, Coach-Steuerprofilen und Coach-Kontaktdaten.
Waerend `sevdesk_send_status='creating'` blockieren Trigger relevante
Quellupdates und Aenderungen/Loeschung des Drafts; die externe HTTP-Anfrage
laeuft nach Commit der Reservierung. Ein Unique Index verhindert lokale
Duplikate je Coach, Quartal und Bundle; die bestehende Trennung von
`reverse_charge` und `normal_ust` bleibt erhalten. Admin-Save/Recalculate
verwendet `updated_at` als Compare-and-Swap. Sitzungen mit fehlendem,
ungueltigem oder nichtpositivem Preis werden angezeigt und blockieren alle
Abrechnungswege.

Der sevDesk-Pfad verlangt serverseitig eine einzelne
`SEVDESK_COACH_INVOICE_TEST_COACH_ID`. Vor POST erfolgt ein lesender
Kontakt-/Quartalsabgleich ueber `GET /Invoice` und fuer erkannte Kandidaten
einen Positionsabgleich. Nur ein eindeutig erkanntes zweites Steuer-Bundle
wird zugelassen; vorhandene gleiche oder uneindeutige Rechnungen bleiben
`creation_unknown` und erfordern manuelle Klaerung. Die damalige Behandlung
von HTTP 400/401 als definitive Ablehnung ist durch den nachfolgenden
vereinfachten Workflow ersetzt: auch diese Antworten bleiben gesperrt.
Serverlogs enthalten keine Rechnungs-, Coach- oder Tokenwerte.

Verifikation: gezielte Mock-Tests pruefen Preisfehler, Canary-Gate,
Duplikaterkennung, Bundles, paginierte sevDesk-Abfragen, parallele
Reservierungsantworten und HTTP-Fehlerklassifizierung; 99 Tests in 5 Dateien
bestanden. Die Gesamtsuite bestand mit 491 Tests in 39 Dateien. Der
Next.js-Produktionsbuild bestand mit ausschliesslich synthetischen
Umgebungswerten, und `git diff --check` war sauber. Keine produktiven
DB-/sevDesk-Schreibzugriffe, Migration, Umgebungsvariablen, Commit, Push oder
Deployment wurden ausgefuehrt. Die Migrationen liefen zusaetzlich in einer
wegwerfbaren lokalen PostgreSQL-15-Datenbank mit synthetischem Basisschema;
Trigger blockierten dort Sitzungs-, Anfrage-, Steuer-, Kontakt- und
Freigabeaenderungen waehrend `creating`. Zwei parallele RPC-Verbindungen
lieferten genau eine Reservierung (`reserved`, danach `draft_mismatch`), und
der Unique Index lehnte einen zweiten Draft desselben Bundles ab. Dieser Test
belegt nicht das Produktivschema, dessen Rollen/RLS, Bestandsdaten oder
providerseitige Vollstaendigkeit des Invoice-Listenabrufs. Der Abgleich nutzt
sevDesks `limit`-/`offset`-Pagination mit maximal 1000 Eintraegen je Seite.
Die Migration stoppt bei lokalen Quartals-Bundle-Duplikaten; vor Rollout sind
beide Quartalsmigrationen und die vorhandene Statusmigration gegen das
Ziel-Schema zu pruefen. Diese lokalen Tests belegen keine Produktionskompatibilitaet.

### Code-Rollout vor Migrationen (2026-10-11)

Der erste Rollout-Versuch wurde vor dem Deployment gestoppt, weil `load-coach`
und `/api/therapist/quarter-release` ohne `coach_quarter_releases` mit 500
antworteten. Behoben durch `app/lib/coachQuarterWorkflowReadiness.js`: lesende
Ansichten funktionieren ohne neue Objekte, alle neuen Schreibaktionen liefern
503 bis zur vollstaendigen Migration. Zusaetzlich liest der Coach-GET nun den
gespeicherten `snapshot` (vorher wurde jede Freigabe als veraltet angezeigt).
Regressionstests: `tests/api/coachQuarterWorkflowMigrationState.test.js`,
`tests/lib/coachQuarterWorkflowReadiness.test.js`; das PostgreSQL-Skript prueft
die Probe-SELECTs vor 08, nach 11 (weiterhin nicht bereit) und nach 12.

### Vereinfachter sevDesk-Workflow und externe ID-Sicherung (2026-10-11)

Der aktuelle lokale Stand legt beide alten Schreib-Syncs serverseitig still.
Normale Saves duerfen externe IDs weder setzen noch aendern. Der manuell
gemeldete Produktionsbestand umfasst zwei Konfliktgruppen mit fuenf lokalen
Zeilen; diese Zuordnung wurde hier nicht live verifiziert. Die additive
Migration 20261012 veraendert diese Zeilen nicht und quarantiniert beide
bekannten externen IDs. Weitere Mehrfachlinks werden dynamisch erkannt.
Neue Claims sichern externe IDs per Primary Key, ohne einen Unique Index
ueber konfliktbehaftete historische Links anzulegen. Pro Coach blockiert
creating/creation_unknown weitere Reservierungen; beide Bundles bleiben
getrennt. Auch HTTP 400/401 werden nicht automatisch wiederholbar.

Quelle: lokaler Code und die vier aufeinander aufbauenden Migrationen;
verantwortlich fuer die lokale Umsetzung: GitHub Copilot im freigegebenen
CTO-Auftrag. Verifikation erfolgt mit Regressionen und dem isolierten
PostgreSQL-Testskript; keine Produktion, kein sevDesk-Schreibzugriff.
Abschliessend bestanden 482 Tests in 40 Dateien, der Next.js-Produktionsbuild
mit synthetischer Konfiguration und deaktivierter Erstellung sowie
`git diff --check`. Die geringere Testzahl gegenueber dem vorherigen Stand
entsteht durch den Ersatz der Tests fuer absichtlich stillgelegte Schreib-Syncs.
Der isolierte PostgreSQL-15-Test bestaetigte unveraenderte historische
Testzeilen und COALESCE-Index, genau eine parallele Bundle-Reservierung,
eindeutige externe Claims bei READ COMMITTED und REPEATABLE READ,
Quellschreibsperren, zwei getrennte Bundle-IDs, dauerhafte Sperre unklarer
Ergebnisse und erneute Ausfuehrbarkeit der additiven Migration 20261012.
VS-Code-Diagnostik meldete keine Fehler in den geaenderten API-/UI-Dateien.
COALESCE im alten Index ist kein Blocker allein wegen Expressions; dessen
tatsaechliche produktive Definition bleibt separat zu vergleichen.
Architecture, Security und AI_CONTEXT sind entsprechend aktualisiert.
Die frueher dokumentierte manuelle Kopf-/Positions-Sync-Funktion ist damit
absichtlich ersetzt; Coach→Klient-Rechnungsfunktionen bleiben unveraendert.

## Schutz generierter Dokumentation

Dateien unter `docs/generated/` dürfen nicht manuell editiert werden, sofern sie durch einen vorhandenen Generator erzeugt werden. Änderungen an generierten Artefakten müssen über den zuständigen Generator oder dessen technische Quellen erfolgen.

Vor Änderungen an einer generierten Datei muss der Agent:

1. Prüfen, ob die Datei tatsächlich generiert ist (Metadaten, Header oder `scripts/`-Mapping).
2. Identifizieren, welcher Generator oder welches Skript die Datei produziert (z. B. `scripts/generate-project-map.mjs`).
3. Änderungen nur vorschlagen, die entweder den Generator-Code oder die zugrunde liegenden Quelldaten betreffen.

Der Agent darf generierte Dateien nur dann manuell ändern, wenn ein klarer, dokumentierter und genehmigter Ausnahmeprozess vorliegt (menschliche Freigabe erforderlich). Solche Ausnahmen müssen in der Audit-Dokumentation vermerkt werden.
