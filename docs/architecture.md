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