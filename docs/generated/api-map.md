# Automatisch erzeugte API-Landkarte

> Diese Datei wird durch `scripts/generate-project-map.mjs` erzeugt.
> Nicht manuell bearbeiten.

Erzeugt am: 2026-07-16T04:52:34.754Z

## `app/api/accounting-settings/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `therapist_invoice_settings`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/add-session/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`, `blocked_slots`, `sessions`, `therapist_booking_settings`
- Google Calendar: `events.delete`, `events.insert`
- Mail-Betreffzeilen: keine erkannt

## `app/api/add-sessions-batch/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`, `blocked_slots`, `sessions`, `therapist_booking_settings`
- Google Calendar: `events.delete`, `events.insert`
- Mail-Betreffzeilen: keine erkannt

## `app/api/admin/billing-sessions/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `sessions`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/admin/booking-overview/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `team_members`, `therapist_booking_settings`, `therapist_google_tokens`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/admin/form-drafts/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/admin/sessions/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `sessions`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/admin-forward/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: `Bitte wähle eine neue Begleitung 🤍`

## `app/api/booked/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `confirmed_appointments`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/booking/book/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`, `blocked_slots`, `sessions`, `team_members`, `therapist_booking_settings`
- Google Calendar: `events.get`, `events.insert`, `events.list`
- Mail-Betreffzeilen: keine erkannt

## `app/api/booking/free-slots/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `anfragen`, `blocked_slots`, `therapist_booking_settings`
- Google Calendar: `events.list`
- Mail-Betreffzeilen: keine erkannt

## `app/api/booking/settings/get/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `team_members`, `therapist_booking_settings`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/booking/settings/save/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `team_members`, `therapist_booking_settings`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/confirm-appointment/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`, `therapist_booking_settings`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: `Dein Termin ist bestätigt 🤍`

## `app/api/confirm-proposal/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`, `appointment_proposals`, `blocked_slots`, `team_members`, `therapist_booking_settings`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: `Dein Erstgespräch ist bestätigt 🤍`, `Erstgespräch wurde bestätigt 🤍`

## `app/api/create-bestand/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/create-request-draft/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/dashboard/me/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/dashboard/requests/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `anfragen`, `appointment_proposals`, `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/delete-session/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `sessions`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/finish-coaching/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: `Danke für dein Vertrauen 🤍 – kurzes Feedback`

## `app/api/form-submit/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`, `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: `Deine Anfrage bei Poise 🤍`, `Neue Anfrage bei Poise 🤍`

## `app/api/forward-request/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: `Wähle jetzt deine passende Begleitung 🤍`

## `app/api/google/calendars/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `team_members`, `therapist_google_tokens`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/google/callback/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `therapist_google_tokens`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/google/start/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/ics/route.js`

- Methoden: `GET`
- Supabase-Tabellen: keine erkannt
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/image-proxy/route.js`

- Methoden: `GET`
- Supabase-Tabellen: keine erkannt
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/invoice-settings/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `therapist_invoice_settings`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/invoices/list/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `invoices`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/invoices/load/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `anfragen`, `sessions`, `team_members`, `therapist_invoice_settings`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/invoices/load-coach/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `sessions`, `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/invoices/save/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `invoices`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/invoices/save-coach/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/invoices/send/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`, `invoices`, `team_members`, `therapist_invoice_settings`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/klaviyo/subscribe/route.js`

- Methoden: `POST`
- Supabase-Tabellen: keine erkannt
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/login/route.js`

- Methoden: `POST`
- Supabase-Tabellen: keine erkannt
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/match-client/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/new-appointment/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`, `blocked_slots`, `therapist_booking_settings`
- Google Calendar: `events.delete`
- Mail-Betreffzeilen: `Bitte neuen Termin auswählen 🤍`

## `app/api/no-match/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: `Zu deiner Anfrage bei Poise`

## `app/api/proposals/create/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`, `appointment_proposals`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: `Deine Terminvorschläge 🤍`

## `app/api/proposals/list/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `appointment_proposals`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/public-availability/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `team_members`, `therapist_booking_settings`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/public-matching-profiles/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/public-request/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/public-team-members/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/reassign-request/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/reject-appointment/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: `Termin wurde abgesagt 🤍`

## `app/api/reminder/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `sessions`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/reminders/send/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `anfragen`, `therapist_booking_settings`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: `Dein Erstgespräch startet in Kürze 🤍`, `Erinnerung an dein Erstgespräch morgen 🤍`

## `app/api/requests/delete-forever/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/requests/update-status/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/send-booking-link/route.js`

- Methoden: `POST`
- Supabase-Tabellen: keine erkannt
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: `Buche hier deinen nächsten Termin 🤍`

## `app/api/send-personal-message/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`, `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/send-proposals/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`, `appointment_proposals`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: `Terminvorschläge für dein Erstgespräch 🤍`

## `app/api/send-video-link/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: `Dein Videolink für das Gespräch 🤍`

## `app/api/sevdesk/create-provision-invoice/route.js`

- Methoden: `POST`
- Supabase-Tabellen: keine erkannt
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/sevdesk/sync-coach-invoice-positions/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/sevdesk/test-invoice/route.js`

- Methoden: `GET`, `POST`
- Supabase-Tabellen: keine erkannt
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/sevdesk/test-update-invoice/route.js`

- Methoden: `GET`, `POST`
- Supabase-Tabellen: keine erkannt
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/sevdesk/update-coach-invoice/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/sevdesk-export-coach-quarterly/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/system-check/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `team_members`, `therapist_booking_settings`, `therapist_invoice_settings`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/team/route.js`

- Methoden: `GET`
- Supabase-Tabellen: keine erkannt
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/team-members/matching-scores/route.js`

- Methoden: `GET`, `POST`
- Supabase-Tabellen: `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/team-members/profile/route.js`

- Methoden: `GET`, `POST`
- Supabase-Tabellen: `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/team-members/toggle-availability/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/team-requests/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/therapist/billing-sessions/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `sessions`, `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/therapist-response/route.js`

- Methoden: `GET`
- Supabase-Tabellen: `confirmed_appointments`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/update-client/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/update-client-vat/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/update-invoice-setting/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/update-meeting-link-override/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/update-session/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `sessions`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/update-status/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`, `team_members`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt

## `app/api/update-tarif/route.js`

- Methoden: `POST`
- Supabase-Tabellen: `anfragen`
- Google Calendar: keine Nutzung erkannt
- Mail-Betreffzeilen: keine erkannt
