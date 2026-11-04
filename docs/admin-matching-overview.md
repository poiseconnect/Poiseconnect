# Admin-Matching-Übersicht (rein lesend)

Stand: 2026-11-04

## Zweck

Grafische, **ausschließlich lesende** Übersicht im Admin-Dashboard über:

1. die Themengewichtungen aller Coaches (Heatmap),
2. die aktuelle Intake-Verfügbarkeit je Coach,
3. die Themenabdeckung durch aktuell verfügbare Coaches.

Die Ansicht dient nur der Beobachtung und Analyse. Sie bietet **keine**
Möglichkeit, Themengewichtungen, Verfügbarkeiten oder andere Coach-Daten zu
verändern, und löst keine Schreibvorgänge aus.

## Datenquellen (unverändert, nur gelesen)

| Information | Quelle |
| --- | --- |
| Themenliste | `app/lib/matchingTopics.js` (`MATCHING_TOPICS`, gemeinsame Themenquelle) |
| Themengewichtung (0–5 je Thema) | `team_members.matching_scores` (JSONB; von Coaches über `/api/team-members/matching-scores` gepflegt) |
| Verfügbarkeit | `team_members.active` + `team_members.available_for_intake` über die bestehende Logik `isCoachAvailableForNewClient` (`app/lib/intakeAvailability.js`) |

Es existieren keine Kapazitätszahlen; dargestellt wird deshalb der vorhandene
Verfügbarkeitsstatus (`Verfügbar` / `Keine Aufnahme` / `Inaktiv`).
`available_for_intake` wird – gemäß bestehender Regel – **nicht** aus Calendar
Mode oder freien Slots abgeleitet.

## Komponenten

### API: `GET /api/admin/matching-overview`

- Datei: `app/api/admin/matching-overview/route.js`
- Auth: Bearer-Token + aktives `team_members`-Mitglied mit `role = "admin"`
  (gleiches Muster wie `app/api/admin/booking-overview/route.js`).
- Liest ausschließlich `team_members`
  (`id, name, profile_name, role, active, available_for_intake, matching_scores`,
  gefiltert auf `role = "therapist"`). Keine Schreiboperationen, nur `GET`.
- Gibt keine E-Mail-Adressen, Preise, Booking- oder Rechnungsdaten aus.

### Aufbereitung: `app/lib/matchingOverview.js`

Reine, getestete Hilfsfunktionen (kein I/O):

- `buildMatchingOverviewRows` – normalisiert Scores (0–5, ungültig → 0) über
  alle `MATCHING_TOPIC_KEYS` und ermittelt den Verfügbarkeitsstatus über
  `isCoachAvailableForNewClient`.
- `sortOverviewRows` – Sortierung nach Name, Verfügbarkeit oder Themen-Key.
- `buildTopicCoverage` / `sortTopicCoverage` – je Thema: Anzahl verfügbarer
  Coaches mit Gewichtung > 0, Gesamtanzahl, Gewichtungssumme und Maximalwert.
- `getCoverageLevel` – Einstufung: `none` (0 verfügbare Coaches), `low` (1),
  `ok` (2–3), `strong` (≥ 4).

### UI: `app/dashboard/MatchingOverview.jsx`

- Neuer Admin-Tab **„Matching“** in `app/dashboard/DashboardFull.jsx`
  (nur bei `role = "admin"` sichtbar; Filterwert `matching`).
- Heatmap: Zeilen = Teammitglieder, Spalten = Themen, Zellfarbe nach
  Gewichtung (Grünskala), exakter Wert in der Zelle und als Tooltip.
- Sortierung: Klick auf „Teammitglied“, „Verfügbarkeit“ oder einen
  Themen-Header; Themenfilter über Chips (Spalten ein-/ausblenden).
- Verfügbarkeitsbadges je Coach plus Zusammenfassung (verfügbar / ohne
  Neuaufnahme / inaktiv).
- Themenabdeckung als Kartenraster mit Hervorhebung von Themen ohne bzw. mit
  nur einem verfügbaren Coach.
- Desktop/Tablet: horizontale Scrollbarkeit der Matrix, sticky Namensspalte.
- Sortierung und Filter sind reiner lokaler UI-State; es gibt keine
  Eingabefelder und keine Mutationen.

## Tests

- `tests/lib/matchingOverview.test.js` – Normalisierung, Verfügbarkeitsstatus,
  Sortierung, Themenabdeckung, Coverage-Level.
- `tests/api/adminMatchingOverviewRoute.test.js` – 401 ohne User, 403 für
  Nicht-Admins und inaktive Admins, erfolgreiche Antwort für Admins,
  Nachweis „nur `team_members` gelesen“ und „nur `GET` exportiert“.

## Keine Auswirkungen auf

- Matching-Logik (Phase 1/2), Formular, Public APIs (`/api/public-*`)
- Datenbankschema, Policies, Trigger, RPCs
- Abrechnung, Buchung, Kalender- und Mail-Logik
