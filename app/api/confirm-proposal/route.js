export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { oauthClient } from "../_lib/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function safeDateString(v) {
  if (!v) return "";

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleString("de-AT", {
    timeZone: "Europe/Vienna",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function POST(req) {
  try {
const { token, proposalId } = await req.json();

console.log("✅ CONFIRM PROPOSAL API HIT", {
  hasToken: !!token,
  proposalId,
});

if (!token || !proposalId) {
  return json({ error: "missing_data" }, 400);
}
    // ------------------------------------------------
// Anfrage über sicheren Booking-Token ermitteln
// ------------------------------------------------
const { data: tokenRequest, error: tokenRequestError } = await supabase
  .from("anfragen")
  .select("id")
  .eq("booking_token", token)
  .single();

if (tokenRequestError || !tokenRequest) {
  console.error("invalid_booking_token", tokenRequestError);
  return json({ error: "invalid_token" }, 404);
}

const requestId = tokenRequest.id;

    // ------------------------------------------------
    // Proposal holen
    // ------------------------------------------------
    const { data: proposal, error: pError } = await supabase
      .from("appointment_proposals")
.select("id, anfrage_id, therapist_id, date, expires_at")      .eq("id", proposalId)
      .single();

    if (pError || !proposal) {
      console.error("proposal_not_found", pError);
      return json({ error: "proposal_not_found" }, 404);
    }

    if (String(proposal.anfrage_id) !== String(requestId)) {
      return json({ error: "proposal_request_mismatch" }, 400);
    }
if (
  proposal.expires_at &&
  new Date(proposal.expires_at) < new Date()
) {
  return json(
    {
      error: "proposal_expired",
      message:
        "Diese Terminvorschläge sind leider abgelaufen. Bitte kontaktiere uns unter hallo@mypoise.de.",
    },
    410
  );
}
    const start = new Date(proposal.date);
    if (Number.isNaN(start.getTime())) {
      return json({ error: "invalid_proposal_date" }, 400);
    }

    const end = new Date(start.getTime() + 60 * 60000);

    // ------------------------------------------------
    // Anfrage holen, damit wir Name / Mail / Linkdaten haben
    // ------------------------------------------------
    const { data: existingRequest, error: reqLoadError } = await supabase
      .from("anfragen")
.select(`
  id,
  vorname,
  nachname,
  email,
  telefon,
  bevorzugte_zeit,
  assigned_therapist_id,
  wunschtherapeut,
  meeting_link_override
`)
      .eq("id", requestId)
      .single();

    if (reqLoadError || !existingRequest) {
      console.error("request_load_failed", reqLoadError);
      return json({ error: "request_not_found" }, 404);
    }

// ------------------------------------------------
// Prüfen, ob der Zeitraum inzwischen belegt ist
// Intervalllogik:
// existing_start < new_end
// AND existing_end > new_start
// ------------------------------------------------
const startISO = start.toISOString();
const endISO = end.toISOString();

const { data: overlappingSlots, error: overlapError } = await supabase
  .from("blocked_slots")
  .select("id, start_at, end_at")
  .eq("therapist_id", proposal.therapist_id)
  .lt("start_at", endISO)
  .gt("end_at", startISO)
  .limit(1);

if (overlapError) {
  console.error("overlap_check_failed", overlapError);

  return json(
    {
      error: "overlap_check_failed",
      detail: overlapError.message,
    },
    500
  );
}

if ((overlappingSlots || []).length > 0) {
  console.warn("proposal_slot_already_taken", {
    requestId,
    proposalId,
  });

  return json(
    {
      error: "slot_taken",
      message:
        "Dieser Termin ist inzwischen leider nicht mehr verfügbar. Bitte wähle einen anderen Terminvorschlag.",
    },
    409
  );
}
   // ------------------------------------------------
// Slot blockieren
// ------------------------------------------------
const { data: blockedSlot, error: blockError } = await supabase
  .from("blocked_slots")
  .insert({
    anfrage_id: requestId,
    therapist_id: proposal.therapist_id,
    start_at: startISO,
    end_at: endISO,
    reason: "proposal_confirmed",
  })
  .select("id")
  .single();

if (blockError || !blockedSlot) {
  console.error("blockError", blockError);

  return json(
    {
      error: "blocked_slot_insert_failed",
      detail: blockError?.message || null,
    },
    500
  );
}

    // ------------------------------------------------
    // Meeting-Link laden
    // ------------------------------------------------
    let bookingSettings = null;

    if (proposal.therapist_id) {
      const { data: bookingData, error: bookingError } = await supabase
        .from("therapist_booking_settings")
.select("meeting_link, selected_calendar_id, time_zone")
        .eq("therapist_id", proposal.therapist_id)
        .single();

      if (bookingError) {
        console.warn("booking_settings_load_failed", bookingError);
      } else {
        bookingSettings = bookingData;
      }
    }
let coach = null;

if (proposal.therapist_id) {
  const { data: coachData, error: coachError } =
    await supabase
      .from("team_members")
      .select("id, name, email")
      .eq("id", proposal.therapist_id)
      .single();

  if (coachError) {
    console.warn("coach_load_failed", coachError);
  } else {
    coach = coachData;
  }
}
 const therapistName =
  coach?.name ||
  existingRequest.wunschtherapeut?.trim() ||
  "dein Coach";
    const terminText = safeDateString(proposal.date);

    const videoLink =
      existingRequest.meeting_link_override ||
      bookingSettings?.meeting_link ||
      "";

    // ------------------------------------------------
// Eigenen Google-Kliententermin erstellen
// POISE VERFÜGBAR bleibt unverändert
// ------------------------------------------------
if (!bookingSettings?.selected_calendar_id) {
  console.error("selected_calendar_id_missing");

  return json(
    { error: "selected_calendar_id_missing" },
    500
  );
}

const oauth = oauthClient();

oauth.setCredentials({
  access_token: process.env.GOOGLE_ACCESS_TOKEN,
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const calendar = google.calendar({
  version: "v3",
  auth: oauth,
});

const clientName =
  `${existingRequest.vorname || ""} ${
    existingRequest.nachname || ""
  }`.trim() || "Klient:in";

const timeZone =
  bookingSettings.time_zone || "Europe/Vienna";

let bookedGoogleEventId = null;

try {
  const descriptionLines = [
    "Poise Erstgespräch",
    `Anfrage-ID: ${requestId}`,
    `Klient: ${clientName}`,
    `E-Mail: ${existingRequest.email || ""}`,
    `Telefon: ${existingRequest.telefon || ""}`,
  ];

  const googleEventRes = await calendar.events.insert({
    calendarId: bookingSettings.selected_calendar_id,

    requestBody: {
      summary: `Poise Erstgespräch – ${clientName}`,

      description: descriptionLines.join("\n"),

      start: {
        dateTime: start.toISOString(),
        timeZone,
      },

      end: {
        dateTime: end.toISOString(),
        timeZone,
      },
    },
  });

  bookedGoogleEventId =
    googleEventRes.data.id || null;

  if (!bookedGoogleEventId) {
    throw new Error("Google Event wurde ohne ID erstellt");
  }

  console.log("✅ PROPOSAL GOOGLE EVENT CREATED", {
    requestId,
    blockedSlotId: blockedSlot.id,
    bookedGoogleEventId,
  });
} catch (googleInsertError) {
  console.error(
    "❌ PROPOSAL GOOGLE EVENT INSERT FAILED:",
    googleInsertError
  );

  // Die gerade gesetzte Sperre wieder entfernen,
  // weil kein Google-Kliententermin erstellt wurde.
  const { error: rollbackError } = await supabase
    .from("blocked_slots")
    .delete()
    .eq("id", blockedSlot.id);

  if (rollbackError) {
    console.error(
      "❌ BLOCKED SLOT ROLLBACK FAILED:",
      rollbackError
    );
  }

  return json(
    {
      error: "google_event_insert_failed",
      detail: String(googleInsertError),
    },
    500
  );
}

// ------------------------------------------------
// Google Event ID im blocked_slot speichern
// ------------------------------------------------
const { error: googleIdSaveError } = await supabase
  .from("blocked_slots")
  .update({
    google_event_id: bookedGoogleEventId,
  })
  .eq("id", blockedSlot.id);

if (googleIdSaveError) {
  console.error(
    "❌ GOOGLE EVENT ID SAVE FAILED:",
    googleIdSaveError
  );

  // Google-Termin wieder entfernen
  try {
    await calendar.events.delete({
      calendarId: bookingSettings.selected_calendar_id,
      eventId: bookedGoogleEventId,
    });
  } catch (googleRollbackError) {
    console.error(
      "❌ GOOGLE EVENT ROLLBACK FAILED:",
      googleRollbackError
    );
  }

  // blocked_slot wieder entfernen
  const { error: blockedRollbackError } = await supabase
    .from("blocked_slots")
    .delete()
    .eq("id", blockedSlot.id);

  if (blockedRollbackError) {
    console.error(
      "❌ BLOCKED SLOT ROLLBACK FAILED:",
      blockedRollbackError
    );
  }

  return json(
    {
      error: "google_event_id_save_failed",
      detail: googleIdSaveError.message,
    },
    500
  );
}

    console.log("📧 about to send mail", {
      to: existingRequest.email,
      therapistName,
      terminText,
      videoLink,
    });

    // ------------------------------------------------
// Anfrage erst nach erfolgreicher Kalenderbuchung bestätigen
// ------------------------------------------------
const { error: updateError } = await supabase
  .from("anfragen")
  .update({
    bevorzugte_zeit: proposal.date,
    assigned_therapist_id: proposal.therapist_id,
    status: "termin_bestaetigt",
  })
  .eq("id", requestId);

if (updateError) {
  console.error("request_update_failed", updateError);

  // Google-Termin wieder entfernen
  try {
    await calendar.events.delete({
      calendarId: bookingSettings.selected_calendar_id,
      eventId: bookedGoogleEventId,
    });
  } catch (googleRollbackError) {
    console.error(
      "❌ GOOGLE EVENT ROLLBACK AFTER REQUEST UPDATE FAILED:",
      googleRollbackError
    );
  }

  // blocked_slot wieder entfernen
  const { error: blockedRollbackError } = await supabase
    .from("blocked_slots")
    .delete()
    .eq("id", blockedSlot.id);

  if (blockedRollbackError) {
    console.error(
      "❌ BLOCKED SLOT ROLLBACK AFTER REQUEST UPDATE FAILED:",
      blockedRollbackError
    );
  }

  return json(
    {
      error: "request_update_failed",
      detail: updateError.message,
    },
    500
  );
}
    // ------------------------------------------------
// Andere Vorschläge erst nach erfolgreicher Buchung löschen
// ------------------------------------------------
const { error: delError } = await supabase
  .from("appointment_proposals")
  .delete()
  .eq("anfrage_id", requestId)
  .neq("id", proposalId);

if (delError) {
  console.error("delError", delError);
}

    // ------------------------------------------------
    // Mail senden
    // ------------------------------------------------
    if (existingRequest.email) {
      const mailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Poise <noreply@mypoise.de>",
          to: existingRequest.email,
          subject: "Dein Erstgespräch ist bestätigt 🤍",
          html: `
            <p>Hallo ${existingRequest.vorname || ""},</p>

            <p>
              danke dir – dein Erstgespräch wurde erfolgreich bestätigt.
            </p>

            <p>
              <strong>Dein Coach:</strong> ${therapistName}<br/>
              <strong>Termin:</strong> ${terminText}
            </p>

            ${
              videoLink
                ? `
                <p>
                  <strong>Hier geht es direkt zu eurem Video-Call:</strong><br/>
                  <a href="${videoLink}" target="_blank" style="color:#8E3A4A; font-weight:600;">
                    👉 Zum Video-Call
                  </a>
                </p>
                `
                : `
                <p>
                  Den Link für euren Video-Call erhältst du in Kürze separat.
                </p>
                `
            }

            <p>
              Falls du den Termin doch nicht wahrnehmen kannst oder etwas dazwischenkommt,
              melde dich bitte unter
              <a href="mailto:hallo@mypoise.de">hallo@mypoise.de</a>.
            </p>

            <p>
              Alles Liebe<br/>
              ${therapistName} 🤍
            </p>
          `,
        }),
      });

      const resendText = await mailRes.text();
      console.log("📧 RESEND STATUS:", mailRes.status);
      console.log("📧 RESEND RESPONSE:", resendText);
    }
if (coach?.email) {

  const hasVideoLink = Boolean(videoLink);

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Poise <noreply@mypoise.de>",
      to: coach.email,
      subject: "Erstgespräch wurde bestätigt 🤍",
html: `
  <p>Hallo ${coach.name || ""},</p>

  <p>
    Ein Erstgespräch wurde soeben ausgewählt und bestätigt.
  </p>

  <p>
    <strong>Klient:in:</strong> ${clientName}<br/>
    <strong>Termin:</strong> ${terminText}
  </p>

  ${
    hasVideoLink
      ? `
      <p>
        Der Videolink wurde der Klientin / dem Klienten bereits automatisch mitgesendet.
      </p>
      `
      : `
      <p>
        <strong>Achtung:</strong> Es ist derzeit kein Videolink hinterlegt.
      </p>

      <p>
        Die Klientin / der Klient hat daher noch keinen Videolink erhalten.
        Bitte sende noch einen Videolink über die Klient:innenkarte
        („Videolink senden“).
      </p>
      `
  }

  <p>
    Liebe Grüße<br/>
    Poise Connect
  </p>
`,
    }),
  });
}
    return json({ ok: true });
  } catch (e) {
    console.error("CONFIRM ERROR:", e);
    return json({ error: "server_error", detail: String(e) }, 500);
  }
}
