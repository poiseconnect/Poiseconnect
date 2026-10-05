# Automatisch erzeugte Kalender-Landkarte

> Diese Datei wird durch `scripts/generate-project-map.mjs` erzeugt.
> Nicht manuell bearbeiten.

Erzeugt am: 2026-10-05T05:10:44.875Z

## `app/api/add-session/route.js`

- Aufrufe: `calendar.events.delete`, `calendar.events.insert`
- Tabellen: `anfragen`, `blocked_slots`, `sessions`, `therapist_booking_settings`

## `app/api/add-sessions-batch/route.js`

- Aufrufe: `calendar.events.delete`, `calendar.events.insert`
- Tabellen: `anfragen`, `blocked_slots`, `sessions`, `team_members`, `therapist_booking_settings`

## `app/api/booking/book/route.js`

- Aufrufe: `calendar.events.get`, `calendar.events.insert`, `calendar.events.list`
- Tabellen: `anfragen`, `blocked_slots`, `sessions`, `team_members`, `therapist_booking_settings`

## `app/api/booking/free-slots/route.js`

- Aufrufe: `calendar.events.list`
- Tabellen: `anfragen`, `blocked_slots`, `therapist_booking_settings`

## `app/api/client/appointment/cancel/route.js`

- Aufrufe: `calendar.events.delete`
- Tabellen: `anfragen`, `blocked_slots`, `team_members`, `therapist_booking_settings`

## `app/api/confirm-proposal/route.js`

- Aufrufe: `calendar.events.delete`, `calendar.events.patch`
- Tabellen: `anfragen`, `appointment_proposals`, `blocked_slots`, `team_members`, `therapist_booking_settings`

## `app/api/cron/expire-proposals/route.js`

- Aufrufe: `calendar.events.delete`
- Tabellen: `appointment_proposals`, `therapist_booking_settings`

## `app/api/new-appointment/route.js`

- Aufrufe: `calendar.events.delete`
- Tabellen: `anfragen`, `blocked_slots`, `therapist_booking_settings`

## `app/api/proposals/create/route.js`

- Aufrufe: `calendar.events.delete`, `calendar.events.insert`
- Tabellen: `anfragen`, `appointment_proposals`, `therapist_booking_settings`
