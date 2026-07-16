# Automatisch erzeugte Kalender-Landkarte

> Diese Datei wird durch `scripts/generate-project-map.mjs` erzeugt.
> Nicht manuell bearbeiten.

Erzeugt am: 2026-07-16T04:52:34.762Z

## `app/api/add-session/route.js`

- Aufrufe: `calendar.events.delete`, `calendar.events.insert`
- Tabellen: `anfragen`, `blocked_slots`, `sessions`, `therapist_booking_settings`

## `app/api/add-sessions-batch/route.js`

- Aufrufe: `calendar.events.delete`, `calendar.events.insert`
- Tabellen: `anfragen`, `blocked_slots`, `sessions`, `therapist_booking_settings`

## `app/api/booking/book/route.js`

- Aufrufe: `calendar.events.get`, `calendar.events.insert`, `calendar.events.list`
- Tabellen: `anfragen`, `blocked_slots`, `sessions`, `team_members`, `therapist_booking_settings`

## `app/api/booking/free-slots/route.js`

- Aufrufe: `calendar.events.list`
- Tabellen: `anfragen`, `blocked_slots`, `therapist_booking_settings`

## `app/api/new-appointment/route.js`

- Aufrufe: `calendar.events.delete`
- Tabellen: `anfragen`, `blocked_slots`, `therapist_booking_settings`
