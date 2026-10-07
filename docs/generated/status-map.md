# Automatisch erzeugte Status-Landkarte

> Diese Datei wird durch `scripts/generate-project-map.mjs` erzeugt.
> Nicht manuell bearbeiten.

Erzeugt am: 2026-10-07T12:41:01.954Z

## `app/api/admin-forward/route.js`

- Statuswerte: `admin_vorschlaege_gesendet`, `admin_weiterleiten`
- Match-State-Werte: keine erkannt

## `app/api/admin-reengage/route.js`

- Statuswerte: `failed`, `sent`, `unknown`
- Match-State-Werte: keine erkannt

## `app/api/booking/book/route.js`

- Statuswerte: `active`, `termin_bestaetigt`
- Match-State-Werte: keine erkannt

## `app/api/client/appointment/cancel/route.js`

- Statuswerte: `termin_neu`
- Match-State-Werte: keine erkannt

## `app/api/client/appointment/reschedule-request/route.js`

- Statuswerte: keine erkannt
- Match-State-Werte: `reschedule_requested`

## `app/api/coach-handover/route.js`

- Statuswerte: `admin_weiterleiten`
- Match-State-Werte: `pending`

## `app/api/confirm-appointment/route.js`

- Statuswerte: `termin_bestaetigt`
- Match-State-Werte: keine erkannt

## `app/api/confirm-proposal/route.js`

- Statuswerte: `confirmed`, `tentative`, `termin_bestaetigt`
- Match-State-Werte: keine erkannt

## `app/api/create-bestand/route.js`

- Statuswerte: `active`
- Match-State-Werte: keine erkannt

## `app/api/create-request-draft/route.js`

- Statuswerte: `draft`
- Match-State-Werte: `draft`

## `app/api/finish-coaching/route.js`

- Statuswerte: `beendet`
- Match-State-Werte: keine erkannt

## `app/api/form-submit/route.js`

- Statuswerte: `neu`
- Match-State-Werte: keine erkannt

## `app/api/forward-request/route.js`

- Statuswerte: `admin_weiterleiten`
- Match-State-Werte: keine erkannt

## `app/api/match-client/route.js`

- Statuswerte: `active`
- Match-State-Werte: keine erkannt

## `app/api/new-appointment/route.js`

- Statuswerte: `termin_neu`
- Match-State-Werte: `reschedule`

## `app/api/no-match/route.js`

- Statuswerte: `papierkorb`
- Match-State-Werte: keine erkannt

## `app/api/proposals/create/route.js`

- Statuswerte: `tentative`
- Match-State-Werte: keine erkannt

## `app/api/reject-appointment/route.js`

- Statuswerte: `abgelehnt`
- Match-State-Werte: keine erkannt

## `app/dashboard/DashboardFull.jsx`

- Statuswerte: `active`, `beendet`, `neu`, `papierkorb`, `termin_bestaetigt`
- Match-State-Werte: keine erkannt

## `app/lib/handlers/confirmAppointment.js`

- Statuswerte: `termin_bestaetigt`
- Match-State-Werte: keine erkannt

## `app/lib/messaging/inbound.js`

- Statuswerte: `queued`, `received`, `review`
- Match-State-Werte: keine erkannt

## `app/lib/messaging/outbound.js`

- Statuswerte: `failed`, `forwarded`, `queued`, `received`, `sent`
- Match-State-Werte: keine erkannt

## `app/lib/teamData.js`

- Statuswerte: `frei`
- Match-State-Werte: keine erkannt

## `tests/api/adminReengageRoute.test.js`

- Statuswerte: `active`, `admin_vorschlaege_gesendet`, `failed`, `termin_bestaetigt`
- Match-State-Werte: keine erkannt

## `tests/dashboard/coachFilter.test.js`

- Statuswerte: `admin_vorschlaege_gesendet`, `future_status`
- Match-State-Werte: keine erkannt

## `tests/lib/draftRecovery.test.js`

- Statuswerte: `draft`, `neu`, `termin_bestaetigt`
- Match-State-Werte: keine erkannt

## `tests/lib/messagingConversationsRoute.test.js`

- Statuswerte: `admin_vorschlaege_gesendet`, `open`
- Match-State-Werte: keine erkannt

## `tests/lib/messagingInbound.test.js`

- Statuswerte: `closed`, `failed`, `forwarded`, `open`, `received`, `review`, `sent`
- Match-State-Werte: keine erkannt

## `tests/lib/messagingOutbound.test.js`

- Statuswerte: `closed`, `failed`, `forwarded`, `open`, `queued`, `received`, `sent`
- Match-State-Werte: keine erkannt

## `tests/lib/proposalMessageRoute.test.js`

- Statuswerte: `forwarded`
- Match-State-Werte: keine erkannt
