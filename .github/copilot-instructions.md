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
- `docs/generated/api-map.md`
- `docs/generated/database-usage.md`
- `docs/generated/calendar-map.md`
- `docs/generated/email-map.md`
- `docs/generated/status-map.md`

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

## Zeitzonenregel

- In der Datenbank UTC speichern.
- Für Nutzer und E-Mails immer `Europe/Vienna` verwenden.
- Niemals die Server-Zeitzone voraussetzen.
- Serverseitige Formatierung muss ausdrücklich enthalten:

```js
timeZone: "Europe/Vienna"