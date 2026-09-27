# Automatisch erzeugte E-Mail-Landkarte

> Diese Datei wird durch `scripts/generate-project-map.mjs` erzeugt.
> Nicht manuell bearbeiten.

Erzeugt am: 2026-09-27T18:37:00.530Z

## `app/api/admin-forward/route.js`

- Betreffzeilen: `Bitte wähle eine neue Begleitung 🤍`

## `app/api/client/appointment/cancel/route.js`

- Betreffzeilen: `Dein Termin wurde abgesagt 🤍`, `Termin wurde abgesagt 🤍`

## `app/api/client/appointment/reschedule-request/route.js`

- Betreffzeilen: `Neuer Termin gewünscht 🤍`

## `app/api/confirm-appointment/route.js`

- Betreffzeilen: `Dein Termin ist bestätigt 🤍`

## `app/api/confirm-proposal/route.js`

- Betreffzeilen: `Dein Erstgespräch ist bestätigt 🤍`, `Erstgespräch wurde bestätigt 🤍`

## `app/api/cron/proposal-reminders/route.js`

- Betreffzeilen: `Deine Terminvorschläge laufen bald ab 🤍`, `Deine Terminvorschläge sind abgelaufen 🤍`, `Deine Terminvorschläge warten auf dich 🤍`

## `app/api/finish-coaching/route.js`

- Betreffzeilen: `Danke für dein Vertrauen 🤍 – kurzes Feedback`

## `app/api/form-submit/route.js`

- Betreffzeilen: `Deine Anfrage bei Poise 🤍`, `Neue Anfrage bei Poise 🤍`

## `app/api/forward-request/route.js`

- Betreffzeilen: `Wähle jetzt deine passende Begleitung 🤍`

## `app/api/new-appointment/route.js`

- Betreffzeilen: `Bitte neuen Termin auswählen 🤍`

## `app/api/no-match/route.js`

- Betreffzeilen: `Zu deiner Anfrage bei Poise`

## `app/api/proposals/create/route.js`

- Betreffzeilen: dynamisch oder nicht automatisch erkannt

## `app/api/proposals/message/route.js`

- Betreffzeilen: `Rückmeldung zu Terminvorschlägen`

## `app/api/proposals/request-new/route.js`

- Betreffzeilen: `Neue Terminvorschläge für ${
            request.vorname || `

## `app/api/reject-appointment/route.js`

- Betreffzeilen: `Termin wurde abgesagt 🤍`

## `app/api/reminders/send/route.js`

- Betreffzeilen: `Dein Erstgespräch startet in Kürze 🤍`, `Erinnerung an dein Erstgespräch morgen 🤍`

## `app/api/send-booking-link/route.js`

- Betreffzeilen: `Buche hier deinen nächsten Termin 🤍`

## `app/api/send-proposals/route.js`

- Betreffzeilen: `Terminvorschläge für dein Erstgespräch 🤍`

## `app/api/send-video-link/route.js`

- Betreffzeilen: `Dein Videolink für das Gespräch 🤍`

## `app/api/therapist-response/route.js`

- Betreffzeilen: dynamisch oder nicht automatisch erkannt

## `app/lib/handlers/confirmAppointment.js`

- Betreffzeilen: `Dein Termin ist bestätigt 🤍`

## `app/lib/messaging/inbound.js`

- Betreffzeilen: `Nachricht von Klient:in: ${String(email?.subject || `

## `app/lib/messaging/outbound.js`

- Betreffzeilen: `Nachricht von Klient:in: ${messageSubject}`

## `app/lib/messaging/proposalMail.js`

- Betreffzeilen: `Deine Terminvorschläge 🤍`

## `tests/lib/draftRecovery.test.js`

- Betreffzeilen: `Deine Anfrage bei Poise 🤍`

## `tests/lib/messagingInbound.test.js`

- Betreffzeilen: `Antwort`, `R\u00fcckfrage`, `Rückfrage`

## `tests/lib/messagingOutbound.test.js`

- Betreffzeilen: `Betreff`, `Organisatorische Frage`, `Rückmeldung zu Terminvorschlägen`

## `tests/lib/messagingSendRoute.test.js`

- Betreffzeilen: `Betreff`

## `tests/lib/proposalMessageRoute.test.js`

- Betreffzeilen: `Rückmeldung zu Terminvorschlägen`
