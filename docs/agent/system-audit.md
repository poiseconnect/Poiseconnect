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

## Schutz generierter Dokumentation

Dateien unter `docs/generated/` dürfen nicht manuell editiert werden, sofern sie durch einen vorhandenen Generator erzeugt werden. Änderungen an generierten Artefakten müssen über den zuständigen Generator oder dessen technische Quellen erfolgen.

Vor Änderungen an einer generierten Datei muss der Agent:

1. Prüfen, ob die Datei tatsächlich generiert ist (Metadaten, Header oder `scripts/`-Mapping).
2. Identifizieren, welcher Generator oder welches Skript die Datei produziert (z. B. `scripts/generate-project-map.mjs`).
3. Änderungen nur vorschlagen, die entweder den Generator-Code oder die zugrunde liegenden Quelldaten betreffen.

Der Agent darf generierte Dateien nur dann manuell ändern, wenn ein klarer, dokumentierter und genehmigter Ausnahmeprozess vorliegt (menschliche Freigabe erforderlich). Solche Ausnahmen müssen in der Audit-Dokumentation vermerkt werden.
