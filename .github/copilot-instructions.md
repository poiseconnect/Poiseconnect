# Poise Connect – GitHub Copilot Instructions

## Projektkontext

Poise Connect ist eine produktive Next.js-Anwendung für:

- Klientenanfragen
- Matching
- Erstgespräche
- Folgesitzungen
- Google-Kalenderbuchungen
- Abrechnung
- Coach- und Admin-Dashboards

Das produktive System läuft auf Vercel und verwendet Supabase.

Vor Änderungen immer zuerst lesen:

- `AI_CONTEXT.md`
- `docs/architecture.md`
- `docs/security.md`
- `docs/agent/cto-workflow.md`
- `docs/agent/system-audit.md`
- `docs/generated/api-map.md`
- `docs/generated/database-usage.md`
- `docs/generated/calendar-map.md`
- `docs/generated/email-map.md`
- `docs/generated/status-map.md`

Langfristigen strategischen Produktkontext liefert `docs/strategy/product-vision.md`. Dieses Dokument ist keine technische Source-of-Truth und keine Freigabe für Architekturänderungen — es dient nur der Einordnung größerer Entscheidungen (siehe Priorität in `docs/agent/cto-workflow.md`).

## Sicherheitsregeln

Das Repository enthält Code für ein System, das sensible und teilweise
gesundheitsbezogene personenbezogene Daten verarbeitet.

Niemals:

- echte Klientendaten in Beispiele übernehmen
- Namen, E-Mail-Adressen oder Telefonnummern aus Logs kopieren
- echte Booking-Tokens anzeigen
- API-Schlüssel oder OAuth-Tokens ausgeben
- Produktionsdatenbank-Dumps erzeugen
- Service-Role-Keys in Client-Code verwenden
- Zugangsdaten in Dateien speichern
- vollständige Request-Bodies mit personenbezogenen Daten loggen

Für Tests ausschließlich künstliche Daten verwenden.

## Arbeitsweise

Vor jeder Änderung:

1. Betroffene Dateien suchen.
2. Zugehörige API-Routen identifizieren.
3. Betroffene Supabase-Tabellen prüfen.
4. Bestehende Mail- und Kalenderlogik prüfen.
5. Risiken für Abrechnung, Buchung und Produktion nennen.
6. Möglichst kleine Änderungen vorschlagen.

Keine bestehenden Funktionen entfernen oder umbenennen, ohne ausdrücklich
darauf hinzuweisen.

Keine komplette Datei ersetzen, wenn eine kleine gezielte Änderung ausreicht.

## Produktionsschutz

- Nie direkt auf `main` arbeiten.
- Änderungen nur auf eigenem Branch.
- Keine automatischen Produktionsdeployments verändern.
- Keine Datenbankmigration ohne ausdrückliche Freigabe.
- Keine Änderungen an Vercel-Umgebungsvariablen ohne ausdrückliche Freigabe.
- Keine automatischen SQL-Ausführungen.
- Keine Löschoperationen auf Produktionsdaten ohne ausdrückliche Freigabe.

## Kalenderregeln

Ein Google-Kalendereintrag mit dem Titel:

`POISE VERFÜGBAR`

definiert einen längeren Verfügbarkeitsblock.

Dieser Block darf niemals:

- in einen Kliententermin umgewandelt werden
- gekürzt werden
- überschrieben werden
- beim Reschedule gelöscht werden

Eine Buchung erzeugt stattdessen:

1. einen separaten Google-Kalendertermin,
2. einen Eintrag in `blocked_slots`,
3. bei Folgesitzungen einen Eintrag in `sessions`.

Beim Reschedule:

1. konkreten Kliententermin löschen,
2. zugehörigen `blocked_slots`-Eintrag löschen,
3. `POISE VERFÜGBAR` unverändert lassen.

## Datenbankregeln

### `sessions`

- Führende Quelle für abrechenbare Sitzungen.
- Änderungen dürfen die bestehende Abrechnung nicht beeinträchtigen.
- `google_event_id` ist technische Zusatzinformation.

### `blocked_slots`

- Dient nur der Sperrung belegter Zeiten.
- Darf nicht als Abrechnungsquelle verwendet werden.
- Zeitüberschneidungen müssen mit Intervalllogik geprüft werden:

`existing_start < new_end AND existing_end > new_start`

### `anfragen`

Wichtige Statuswerte:

- `neu`
- `termin_neu`
- `termin_bestaetigt`
- `active`
- `admin_pruefen`
- `beendet`
- `papierkorb`

Vor Statusänderungen prüfen, in welchen Tabs die Anfrage anschließend
sichtbar oder unsichtbar wird.

## Teamdaten und Public APIs

- `teamData` ist ein statischer Fallback- und Matchingbestand, aber nicht die
	alleinige Source of Truth für laufende Coach-Profile oder Betriebsdaten.
- Dashboard-Änderungen in `team_members` und `therapist_booking_settings`
	werden dynamisch gelesen und erzeugen keinen Git-Commit.
- `/api/public-team-members` ist ausschließlich der whitelisted
	WordPress-Websitevertrag. Niemals dort `qualificationLevel`, numerische
	Scores, `matching_scores`, E-Mail, ICS, Calendar Mode, Booking-/Proposal-
	Daten, Preise, Sessions oder Rechnungsdaten ergänzen.
- Das Anfrageformular verwendet `/api/public-team-members` nicht. Es kombiniert
	`teamData`, `/api/form-team-members` und `/api/public-availability`.
- `available_for_intake` bedeutet neue Klient:innen annehmen. Es darf weder aus
	Calendar Mode noch aus konkreten freien Slots abgeleitet werden.
- `profile_role` ist die berufliche Profilbeschreibung; `team_members.role`
	kann eine Systemrolle für Autorisierung sein. Diese Bedeutungen nicht
	vermischen.
- `app/lib/matchingTopics.js` ist die gemeinsame Themenquelle. Keine weitere
	Themenliste für Formular oder Website einführen.
- `qualificationLevel` ist internes Ranking und niemals ein Public-Filter oder
	Public-Feld.
- Matching Phase 1/2 nur über die zentralen Helper ändern. Keine parallele
	lokale Qualification- oder Leidensdrucklogik ergänzen.
- Coach-Arbeitsweisen, Methoden, Kompetenzen, Passungen oder Grenzen niemals
	aus KI ableiten oder erfinden. Für Website, Matching und Empfehlungen nur
	ausdrücklich vom Coach bestätigte und freigegebene Inhalte verwenden.
- Bestehende historische Admin-Auswahlen nicht durch Regeln für neue
	Vermittlungen entfernen.

## WordPress-Grenze

- `mypoise.de` ist die öffentliche WordPress-/Elementor-Seite; `app.mypoise.de`
	ist Poise Connect.
- Keine zweite produktive Next.js-Teamseite erstellen.
- Das spätere WordPress-Plugin nutzt serverseitiges `wp_remote_get()` auf die
	Public-Team-API. Keine CORS-Freigabe nur für diesen Server-zu-Server-Request
	hinzufügen.
- WordPress bleibt führend für Coach-Detailseiten. Die spätere Zuordnung erfolgt
	über WordPress Post Meta `poise_coach_id`; keine Name-zu-Slug-Heuristik oder
	URL-Duplikation in Poise Connect einführen.

## Zeitzonenregel

- In der Datenbank UTC speichern.
- Für Nutzer und E-Mails immer `Europe/Vienna` verwenden.
- Niemals die Server-Zeitzone voraussetzen.
- Serverseitige Formatierung muss ausdrücklich enthalten:

```js
timeZone: "Europe/Vienna"