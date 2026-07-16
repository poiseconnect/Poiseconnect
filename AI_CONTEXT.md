# Poise Connect – AI Project Context

## Zweck

Poise Connect verwaltet Anfragen, Matching, Erstgespräche,
Folgesitzungen, Terminbuchungen und Abrechnung für Coaches
und psychologische Fachkräfte.

Dieses Dokument beschreibt ausschließlich die technische Architektur.

Es dürfen keine personenbezogenen Daten oder Produktionsdatensätze
in diese Dokumentation übernommen werden.

## Verbindliche Codequelle

Das private GitHub-Repository ist die einzige verbindliche Quelle
für den aktuellen Programmcode.

Eine spätere KI-Suchdatenbank darf nur einen abgeleiteten Suchindex
enthalten. Sie ist niemals die primäre Codequelle.

## Technischer Stack

- Next.js mit App Router
- Vercel
- Supabase / PostgreSQL
- Google Calendar API
- Resend
- Klaviyo
- sevDesk
- JavaScript und React

## Datenschutzregeln

Folgende Inhalte dürfen niemals in KI-Dokumentation,
Embeddings, Prompts, Beispieldaten oder externe KI-Indizes
übernommen werden:

- Namen realer Klientinnen und Klienten
- E-Mail-Adressen
- Telefonnummern
- Anschriften
- Geburtsdaten
- Freitext-Anliegen
- Diagnosen
- Leidensdruck
- Gesprächsnotizen
- echte Buchungstokens
- echte Kalenderinhalte mit Personendaten
- Meeting-Links
- API-Schlüssel
- Passwörter
- OAuth-Tokens
- Supabase-Service-Role-Keys

Für Beispiele ausschließlich erfundene Daten verwenden.

## Zentrale Tabellen

### anfragen

Verwaltet Klientenanfragen, Matching und Status.

Wichtige technische Felder:

- id
- status
- match_state
- assigned_therapist_id
- wunschtherapeut
- bevorzugte_zeit
- booking_token

### sessions

Verwaltet abrechenbare Sitzungen.

Wichtige technische Felder:

- id
- anfrage_id
- therapist_id
- date
- duration_min
- price
- commission
- payout
- google_event_id

Die Abrechnung basiert auf `sessions`.

### blocked_slots

Sperrt einzelne Zeiträume für öffentliche Buchungen.

Wichtige technische Felder:

- id
- anfrage_id
- therapist_id
- start_at
- end_at
- reason
- google_event_id

`blocked_slots` darf die Abrechnung nicht beeinflussen.

### therapist_booking_settings

Enthält Booking-Einstellungen eines Coaches.

Wichtige technische Felder:

- therapist_id
- booking_enabled
- selected_calendar_id
- time_zone
- meeting_link

## Kalendergrundregel

Ein Google-Kalendereintrag mit dem Titel:

`POISE VERFÜGBAR`

definiert einen längeren Verfügbarkeitszeitraum.

Dieser Verfügbarkeitsblock darf durch eine Buchung niemals
überschrieben, verkürzt oder gelöscht werden.

Eine Buchung erzeugt:

1. einen eigenen Google-Kalendertermin,
2. einen Eintrag in `blocked_slots`,
3. bei Folgesitzungen zusätzlich einen Eintrag in `sessions`.

## Zeitzonenregel

- Zeitwerte werden in UTC gespeichert.
- Anzeigen und E-Mails werden in `Europe/Vienna` formatiert.
- Jede serverseitige Mailformatierung muss die Zeitzone ausdrücklich setzen.
- Die lokale Zeitzone eines Vercel-Servers darf niemals vorausgesetzt werden.

## Booking Mode

1. Klientin oder Klient wählt eine Zeit.
2. Die Buchung erzeugt einen separaten Google-Termin.
3. Der gebuchte Teilzeitraum wird in `blocked_slots` gesperrt.
4. Der Coach bestätigt den Termin.
5. Erst die Bestätigung löst die finale Bestätigungsmail aus.

## Proposal Mode

1. Anfrage wird an einen Coach weitergeleitet.
2. Coach sendet Terminvorschläge.
3. Klientin oder Klient wählt einen Vorschlag.
4. Der Termin wird bestätigt.

## Reschedule

Bei einer Terminänderung:

1. konkreten Google-Kliententermin löschen,
2. zugehörigen Eintrag aus `blocked_slots` löschen,
3. den Block `POISE VERFÜGBAR` unverändert lassen,
4. die Anfrage auf `match_state = reschedule` setzen,
5. neuen Buchungslink senden.

## Abrechnung

- Die Abrechnung basiert auf `sessions`.
- Google-Kalenderdaten sind nicht die führende Abrechnungsquelle.
- `blocked_slots` ist ausschließlich für Verfügbarkeiten und Kollisionsschutz zuständig.

## Sicherheitsregel für KI

KI-Zugriffe beginnen ausschließlich lesend.

Folgende Aktionen benötigen immer eine ausdrückliche menschliche Freigabe:

- Datei verändern
- Commit erzeugen
- Pull Request mergen
- Datenbankmigration ausführen
- Umgebungsvariablen verändern
- Produktion deployen
- produktive Daten lesen oder verändern