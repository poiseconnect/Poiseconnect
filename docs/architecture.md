# Systemarchitektur

## Produktiver Datenfluss

Browser
→ Next.js Frontend
→ Next.js API Route
→ Supabase, Google Calendar oder Resend
→ Antwort an den Browser

## Next.js

Next.js enthält:

- öffentliche Formulare,
- Coach-Dashboard,
- Admin-Dashboard,
- API-Routen,
- Mailhandler,
- Terminlogik,
- Abrechnungsfunktionen.

## Supabase

Supabase enthält unter anderem:

- Anfragen,
- Sitzungen,
- Booking-Einstellungen,
- blockierte Zeiträume,
- Rollen,
- Teammitglieder.

## Google Calendar

Google Calendar enthält:

- längere Blöcke mit dem Titel `POISE VERFÜGBAR`,
- separate Erstgesprächstermine,
- separate Folgesitzungen.

## Resend

Resend versendet unter anderem:

- Anfragebestätigungen,
- Terminvorschläge,
- finale Terminbestätigungen,
- Coach-Benachrichtigungen.

## Klaviyo

Klaviyo wird für Newsletter, Impulsserien und Segmentierung verwendet.

## sevDesk

sevDesk wird für Rechnungs- und Abrechnungsprozesse angebunden.

## Kritische technische Regeln

- `POISE VERFÜGBAR` niemals in einen Kliententermin umwandeln.
- Einen gebuchten Termin als eigenes Google Event anlegen.
- Jeden belegten Zeitraum in `blocked_slots` speichern.
- Jede abrechenbare Sitzung in `sessions` speichern.
- Zeitwerte in UTC speichern.
- Zeitwerte für Nutzerinnen und Nutzer in `Europe/Vienna` anzeigen.
- Produktive Zugangsdaten niemals im Repository speichern.

## Aktueller Systemzuschnitt

Die öffentliche Website und die Poise-Connect-App sind getrennte Systeme.

```text
mypoise.de
	WordPress auf Raidboxes mit Elementor
	bestehende Team- und Coach-Detailseiten
	zukünftig: [poise_team] WordPress-Plugin
			 │ serverseitiger wp_remote_get
			 ▼
app.mypoise.de/api/public-team-members
			 │
			 ▼
Poise Connect: Next.js, Supabase, Google Calendar, Resend, Klaviyo, sevDesk
```

WordPress bleibt führend für öffentliche Seiten, Detailseiten, SEO und
Darstellung. Poise Connect ist führend für App-Workflows und liefert der
Website ausschließlich den explizit freigegebenen Public-Datenvertrag. Es gibt
keine produktive Next.js-Teamseite unter `app.mypoise.de/team`.

### WordPress-Integration (geplant, nicht Bestandteil dieses Repositories)

Das spätere WordPress-Plugin `poise-team` soll einen `[poise_team]`-Shortcode
bereitstellen. Elementor bindet ihn über ein Shortcode-Widget ein. Das Plugin
holt Daten serverseitig von `https://app.mypoise.de/api/public-team-members`.
Dadurch ist kein Browser-CORS erforderlich und es sollen keine CORS-Header
allein für WordPress ergänzt werden.

V1-Plugin-Verhalten:

- WordPress-Transient mit ungefähr zehn Minuten TTL und Last-known-good-Fallback
- Themen: OR innerhalb der Gruppe
- Ausbildungen: OR innerhalb der Gruppe
- Themen und Ausbildungen: AND zwischen Gruppen
- vorhandene WordPress-Detailseiten werden über Post Meta `poise_coach_id` auf
	die API-Coach-ID abgebildet; URLs werden nicht in Poise Connect dupliziert
- WordPress implementiert sein eigenes Video-Modal mit derselben `video`-URL

## Team- und Profilarchitektur

### Drei Datenebenen

`teamData` in `app/lib/teamData.js` ist ein statischer Fallback- und
Matchingbestand. Es enthält insbesondere Coach-ID, Bild, allgemeines
Vorstellungsvideo, statische Profilgrunddaten, `qualificationLevel`,
Fallback-Themenscores und Legacy-/Formulardaten.

Supabase ist führend für laufende Dashboard- und Betriebsdaten in
`team_members` und `therapist_booking_settings`. Dashboard-Änderungen erzeugen
keinen Git-Commit. Sie werden dynamisch gelesen und dürfen nicht durch die
Annahme ersetzt werden, `teamData` sei alleinige Source of Truth.

Das Anfrageformular kombiniert drei Verträge:

```text
teamData
	+ /api/form-team-members       (dynamische Profil-Overrides)
	+ /api/public-availability    (Intake, Matching-Scores, Booking-Status)
```

`/api/form-team-members` ersetzt nur vorhandene dynamische Werte über
`mergeFormTeamMembers`. Es liefert Name, Profilrolle, Kurzprofil, Keywords,
Profil-Calendar-Mode, Preise, Paarcoaching und Proposal-Zeitgrenzen. Statische
Matchingfelder wie `qualificationLevel` und Fallback-Scores bleiben erhalten.

`/api/public-team-members` ist bewusst kein Formularvertrag. Er ist die
whitelisted Website-Bridge für WordPress.

### Source-of-Truth-Matrix

| Feld oder Konzept | Fachliche Bedeutung | Führende Quelle und Speicherort | Wichtige Consumer | Öffentlich |
| --- | --- | --- | --- | --- |
| `active` | Teammitglied ist im System aktiv | `team_members.active` | Availability, Admin-Weiterleitung, Public Directory | Nein |
| `available_for_intake` | Nimmt neue Klient:innen an | `team_members.available_for_intake` | Availability, Admin-Weiterleitung, Public Directory | Nur als serverseitiger Filter |
| Systemrolle `role` | Autorisierung, z. B. `admin` oder `therapist` | `team_members.role` | Dashboard- und Admin-APIs | Nein |
| Profilrolle | Öffentliche berufliche Beschreibung | `team_members.profile_role`, Fallback `teamData.role` | Formular, Public Directory | Ja, als `role` |
| `qualificationLevel` | internes Qualification-Rankingsignal | `teamData.qualificationLevel` | aktiver Formular-Matcher | Nein |
| Matching-Scores | dynamische Coach-Themeneignung | `team_members.matching_scores`, Fallback `teamData.scores` | Formularmatching, Public-Topic-Ableitung | Nur abgeleitete Topic-Keys |
| Coach-Bild | öffentliches Profilbild | `teamData.image` | Formular, Public Directory | Ja |
| Coach-Video | allgemeines Vorstellungsvideo | `teamData.video` | Formular, Public Directory, spätere WordPress-Karte | Ja |
| Kurzprofil | öffentliche Kurzbeschreibung | `team_members.profile_short`, Fallback `teamData.short` | Formular, Public Directory | Ja |
| Calendar Mode | Prozessart `proposal`, `booking` oder `ics` | `team_members.profile_calendar_mode`, Fallback `teamData.calendar_mode` | Formular | Nein |
| `booking_enabled` | Booking ist für einen Coach aktiviert | `therapist_booking_settings.booking_enabled` | Availability, Slot-APIs | Nein |
| Proposal-Zeitgrenzen | grober UX-Hinweis für Proposal-Termine | `team_members.proposal_earliest_time` / `proposal_latest_time` | Formular | Nein |
| Strukturierte Zeitpräferenz | frühe grobe Präferenz der Klient:in | `anfragen.structured_time_preference` | Resume, Coach-Auswahl, Proposal-Hinweis | Nein |
| Standard-/ermäßigter Preis | Preisangabe im Formular | `team_members.profile_preis_std` / `profile_preis_ermaessigt`, Fallback `teamData` | Formular | Nein |
| Paarcoaching, Preis, Dauer | Paarcoaching-Angebot | `team_members.paarcoaching`, `paarcoaching_preis`, `paarcoaching_dauer_min` | Formular | Nein |
| `selected_calendar_id` | technischer Google-Kalender | `therapist_booking_settings.selected_calendar_id` | Booking, Proposal, Sessions | Nein |

## Public- und Private-API-Grenze

### `/api/public-team-members`

Diese unauthentifizierte Route ist der einzige vorgesehene Website-Vertrag. Sie
fragt `team_members` serverseitig mit `active = true` und
`available_for_intake = true` ab und wendet zusätzlich die defensive
Testprofil-Erkennung aus `publicCoachDirectory` an.

Der Response ist explizit auf folgende Felder begrenzt:

```text
id, name, role, educationCategories, short, image, video, topics, requestUrl
```

`requestUrl` ist eine absolute URL zu `https://app.mypoise.de/` mit der
bestehenden `therapist`-Query-Vorauswahl. Nicht ausgegeben werden
`qualificationLevel`, numerische Scores, `matching_scores`, E-Mail, ICS,
Calendar Mode, Booking-/Proposal-Daten, Preise, Sessions, Rechnungen oder
interne Statusdaten.

### Formularverträge

`/api/form-team-members` ist ein schlanker, formularspezifischer
Profil-Override-Vertrag. Er darf nicht als WordPress- oder allgemeiner
Public-Directory-Vertrag wiederverwendet werden.

`/api/public-availability` wird vom unauthentifizierten Anfrageformular für
`active`, `available_for_intake`, `matching_scores` und `booking_enabled`
verwendet. Sein breiterer Response ist historischer Formularbedarf und nicht
für WordPress bestimmt.

## Themen- und Matchingarchitektur

`app/lib/matchingTopics.js` ist die zentrale Definition der fachlichen
Themenkeys, Labels und Beschreibungen. Anfrageformular und Public Directory
verwenden dieselbe Liste. Es darf keine zweite Website-Themenliste entstehen.

Positive Matching-Scores bedeuten Themenpassung. Für das Public Directory wird
ein Coach einem Topic zugeordnet, wenn der wirksame Score größer als null ist;
die Zahl selbst bleibt privat.

### Aktiver Formularmatcher

Der produktiv aktive Matcher liegt in `app/page-client.jsx` im `matchedTeam`
`useMemo`:

1. summiert Scores für ausgewählte Themen,
2. fügt einen rollenbasierten Themenbonus hinzu,
3. berechnet einen dynamisch gewichteten Qualification-Bonus,
4. filtert bei ausgewählten Themen strikt auf `_themeScore > 0`,
5. sortiert nach dem finalen Score.

Themenpassung ist damit Eligibility-Gate. Qualification kann einen Coach ohne
positives Themenmatch nicht sichtbar machen.

`app/lib/qualificationBonus.js` ist die zentrale reine Helper-Implementierung
für Qualification-Bonus, Themenprüfung und Finalscore. Das ältere
`app/lib/matchTeamMembers.js` ist ein Legacy-Text-/Keyword-Helper und nicht der
aktive Anfrageformularpfad. Es nutzt zumindest dieselbe Richtung des
Qualification-Bonus, bleibt aber ein Risiko für zukünftige Drift.

### Qualification Phase 1

`qualificationLevel` ist ein internes Ranking-Signal mit folgender Richtung:

| Level | Basisbonus |
| --- | --- |
| 1 | 2.0 |
| 2 | 1.5 |
| 3 | 1.0 |
| 4 | 0.5 |
| 5 | 0.0 |

### Qualification Phase 2

Der Basisbonus wird mit `getQualificationWeight` gewichtet:

| Leidensdruck | Gewicht |
| --- | --- |
| niedrig | 0.5 |
| mittel oder unbekannt | 1.0 |
| hoch | 1.5 |
| sehr hoch | 2.0 |

`diagnose = ja` addiert `0.5`; `nein`, fehlende oder unbekannte Werte addieren
null. Der maximale Qualification-Bonus ist daher `2.0 × 2.5 = 5.0`. Diese
Gewichtung verändert nur das Ranking innerhalb geeigneter Coaches, nie das
Themen-Gate.

## Verfügbarkeit, Admin und Termine

Folgende Konzepte sind strikt getrennt:

1. `available_for_intake`: Nimmt ein Coach neue Klient:innen an?
2. Calendar Mode: Welcher Prozess (`proposal`, `booking`, `ics`) wird genutzt?
3. Konkrete Kalenderverfügbarkeit: Welche Termine sind tatsächlich frei?

Calendar Mode und freie Slots dürfen nicht als Intake-Verfügbarkeit
interpretiert werden.

`app/lib/intakeAvailability.js` zentralisiert die Regel für neue
Vermittlungen. `/api/admin-forward` prüft beim POST erneut
`active === true && available_for_intake === true` und lehnt ungültige Coaches
ab. Das schützt gegen eine Statusänderung zwischen Dialogöffnung und Absenden.
Historisch ausgewählte `admin_therapeuten` bleiben im Admin-Kontext sichtbar;
Handover ist nicht automatisch eine Neuvermittlung.

### Proposal, Booking und Resume

- `proposal`: Coach erstellt `appointment_proposals`; Proposal-Zeitgrenzen und
	`structured_time_preference` sind nur UX-Hinweise, keine harte
	serverseitige Zeitvalidierung.
- `booking`: `/api/booking/free-slots` leitet buchbare Teilslots aus
	`POISE VERFÜGBAR`-Blöcken, Booking-Einstellungen und `blocked_slots` ab.
	`/api/booking/book` erstellt einen separaten Kliententermin und sperrt ihn;
	der Availability-Block wird nicht umgewandelt oder gelöscht.
- `resume`: `proposalTimePreference` entscheidet für Coach-Auswahl-Resumes
	(`admin`, `5`, `8`), ob zuerst die strukturierte Zeitpräferenz erfragt wird.
- Reschedule: `/api/new-appointment` löscht nur den konkreten Kliententermin
	und den zugehörigen `blocked_slots`-Eintrag; `POISE VERFÜGBAR` bleibt
	unverändert.

## Sessions und Billing

`sessions` ist die führende Quelle für abrechenbare Sitzungen. `blocked_slots`
ist ausschließlich Kollisions- und Belegungsdatenbestand. Session- und
Invoice-Routen arbeiten auf `sessions`, `anfragen`, `invoices`,
`therapist_invoice_settings` und `team_members`; Google-Event-IDs sind
technische Referenzen, keine Abrechnungsquelle.

## Wichtige API-Gruppen

| Gruppe | Beispiele | Zweck und Source of Truth |
| --- | --- | --- |
| Website Public | `/api/public-team-members` | Whitelisted Website-Daten aus `team_members` und `teamData` |
| Formular | `/api/form-team-members`, `/api/form-submit` | Profil-Overrides und Persistenz nach `anfragen` |
| Matching/Availability | `/api/public-availability`, `/api/team-members/matching-scores` | Intake-, Booking- und Score-Daten aus `team_members` und Booking Settings |
| Coach | `/api/team-members/profile`, `/api/therapist/*` | Authentifiziertes Coach-Profil, Sessions und Billing |
| Admin | `/api/admin-forward`, `/api/dashboard/*`, `/api/requests/*` | Authentifizierte Admin- und Dashboard-Workflows |
| Proposal | `/api/proposals/*`, `/api/confirm-proposal` | Vorschläge, Reservierungen und Bestätigung |
| Booking | `/api/booking/*`, `/api/confirm-appointment`, `/api/new-appointment` | Slots, Buchung, Bestätigung und Reschedule |
| Sessions/Billing | `/api/add-session`, `/api/delete-session`, `/api/invoices/*` | Sitzungen, Rechnungen und Payout-Grundlagen |
| Cron | `/api/cron/*`, `/api/reminders/send` | Erinnerungen und Ablaufprozesse |

## Verifizierte Risiken und Tech Debt

### P0 – Schutz personenbezogener Daten in Logs

Mehrere terminbezogene Routen protokollieren vollständige Request-Bodies oder
geladene Anfrageobjekte, unter anderem `/api/booking/book`,
`/api/proposals/create`, `/api/new-appointment` und `/api/add-session`.
Diese Flüsse verarbeiten sensible Klient:innen- und Termindaten. Das verstößt
gegen die Logging-Regel aus `docs/security.md` und muss vor einer breiteren
Produktionsexposition als separater Security-Task bereinigt werden.

### P1 – Breiter historischer Availability-Vertrag

`/api/public-availability` ist ohne Authentifizierung erreichbar und gibt
`matching_scores` sowie `booking_enabled` zurück, weil das Anfrageformular sie
heute verwendet. Er ist nicht der WordPress-Public-Vertrag. Eine spätere
Härtung sollte den tatsächlichen Browserbedarf minimieren und das Themenmatching
serverseitig bewerten, ohne den aktuellen Formularflow ungetestet zu brechen.

### P1 – Statische und dynamische Teamdaten

`teamData` bleibt für Bild, Video, Qualification und Fallback-Matching nötig;
Supabase überschreibt laufende Profil- und Betriebsdaten. Jede neue Teamfunktion
muss diese Kombination bewusst wählen. Ein vollständiger Ersatz ohne
Migrations- und Regressionplan wäre riskant.

### P2 – Legacy-Matchinghelper

`matchTeamMembers.js` ist nicht der aktive Anfrageformularpfad. Seine
Text-/Keyword-Logik und der aktive strukturierte Matcher können langfristig
driften. Vor Änderungen muss entschieden werden, ob er migriert oder explizit
stillgelegt wird.

### P2 – Generierte Karten aktualisieren

Dateien unter `docs/generated/` sind automatisch erzeugt. Ihre Header weisen
auf `scripts/generate-project-map.mjs` hin. Nach größeren API-Strukturänderungen
soll der Generator bewusst ausgeführt und sein Ergebnis geprüft werden; diese
Dateien dürfen nicht manuell geändert werden.

### P3 – Alte Resume- und Routenvielfalt

Mehrere Resume-Modi und historische API-Pfade sind produktiv relevant. Sie
sollten nicht ohne Workflow-Tests vereinfacht oder entfernt werden.