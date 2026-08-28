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
  console.error("invalid_booking_token", { code: tokenRequestError?.code || null });
  return json({ error: "invalid_token" }, 404);
}

const requestId = tokenRequest.id;

    // ------------------------------------------------
    // Proposal holen
    // ------------------------------------------------
const { data: proposal, error: pError } = await supabase
  .from("appointment_proposals")
  .select(
    "id, anfrage_id, therapist_id, date, expires_at, google_event_id"
  )
  .eq("id", proposalId)
  .single();

    if (pError || !proposal) {
      console.error("proposal_not_found", { code: pError?.code || null });
      return json({ error: "proposal_not_found" }, 404);
    }
if (!proposal.google_event_id) {
  console.error("proposal_google_event_id_missing", {
    proposalId,
    requestId,
  });

  return json(
    {
      error: "proposal_google_event_missing",
    },
    500
  );
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
      console.error("request_load_failed", { code: reqLoadError?.code || null });
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
  console.error("overlap_check_failed", { code: overlapError?.code || null });

  return json(
    {
      error: "overlap_check_failed",
      detail: "INTERNAL_ERROR",
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
// SLOT BLOCKIEREN
// ------------------------------------------------
const { data: blockedSlot, error: blockError } = await supabase
  .from("blocked_slots")
  .insert({
    anfrage_id: requestId,
    therapist_id: proposal.therapist_id,
    start_at: startISO,
    end_at: endISO,
    reason: "proposal_confirmed",
    google_event_id: proposal.google_event_id,
  })
  .select("id")
  .single();

if (blockError || !blockedSlot) {
  console.error("blocked_slot_insert_failed", { code: blockError?.code || null });

  return json(
    {
      error: "blocked_slot_insert_failed",
      detail: "INTERNAL_ERROR",
    },
    500
  );
}

// ------------------------------------------------
// BOOKING SETTINGS DES COACHS LADEN
// ------------------------------------------------
let bookingSettings = null;

if (proposal.therapist_id) {
  const { data: bookingData, error: bookingError } =
    await supabase
      .from("therapist_booking_settings")
      .select(
        "meeting_link, selected_calendar_id, time_zone"
      )
      .eq("therapist_id", proposal.therapist_id)
      .single();

  if (bookingError) {
    console.warn(
      "booking_settings_load_failed",
      bookingError
    );
  } else {
    bookingSettings = bookingData;
  }
}

// ------------------------------------------------
// COACH LADEN
// ------------------------------------------------
let coach = null;

if (proposal.therapist_id) {
  const { data: coachData, error: coachError } =
    await supabase
      .from("team_members")
      .select("id, name, email")
      .eq("id", proposal.therapist_id)
      .single();

  if (coachError) {
    console.warn(
      "coach_load_failed",
      coachError
    );
  } else {
    coach = coachData;
  }
}

// ------------------------------------------------
// TEXTE / LINKS VORBEREITEN
// ------------------------------------------------
const therapistName =
  coach?.name ||
  existingRequest.wunschtherapeut?.trim() ||
  "dein Coach";

const terminText =
  safeDateString(proposal.date);

const videoLink =
  existingRequest.meeting_link_override ||
  bookingSettings?.meeting_link ||
  "";

const appBaseUrl = (
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://poiseconnect.vercel.app"
).replace(/\/$/, "");

const manageLink =
  `${appBaseUrl}/termin-verwalten/${encodeURIComponent(
    token
  )}`;
// ------------------------------------------------
// VORHANDENE GOOGLE-RESERVIERUNG BESTÄTIGEN
// ------------------------------------------------
if (!bookingSettings?.selected_calendar_id) {
  console.error("selected_calendar_id_missing");

  // blocked_slot wieder entfernen
  await supabase
    .from("blocked_slots")
    .delete()
    .eq("id", blockedSlot.id);

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

const bookedGoogleEventId = proposal.google_event_id;

try {
  const descriptionLines = [
    "Poise Erstgespräch",
    `Anfrage-ID: ${requestId}`,
    `Klient: ${clientName}`,
    `E-Mail: ${existingRequest.email || ""}`,
    `Telefon: ${existingRequest.telefon || ""}`,
  ];

  await calendar.events.patch({
    calendarId: bookingSettings.selected_calendar_id,
    eventId: bookedGoogleEventId,

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

      status: "confirmed",
      transparency: "opaque",
    },
  });

  console.log("✅ PROPOSAL GOOGLE EVENT CONFIRMED", {
    requestId,
    proposalId,
    blockedSlotId: blockedSlot.id,
    bookedGoogleEventId,
  });
} catch {
  console.error("PROPOSAL GOOGLE EVENT PATCH FAILED");

  // blocked_slot wieder entfernen,
  // weil die Reservierung nicht bestätigt werden konnte
  const { error: rollbackError } = await supabase
    .from("blocked_slots")
    .delete()
    .eq("id", blockedSlot.id);

  if (rollbackError) {
    console.error("BLOCKED SLOT ROLLBACK FAILED");
  }

  return json(
    {
      error: "google_event_patch_failed",
      detail: "INTERNAL_ERROR",
    },
    500
  );
}

    console.log("CONFIRM PROPOSAL MAIL PREPARED");

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
  console.error("request_update_failed");

  // ------------------------------------------------
  // Google-Termin wieder zur Reservierung zurücksetzen
  // ------------------------------------------------
  try {
    await calendar.events.patch({
      calendarId: bookingSettings.selected_calendar_id,
      eventId: bookedGoogleEventId,

      requestBody: {
        summary: "Poise – Terminoption reserviert",

        description:
          "Vorläufig reservierter Poise-Terminvorschlag.",

        start: {
          dateTime: start.toISOString(),
          timeZone,
        },

        end: {
          dateTime: end.toISOString(),
          timeZone,
        },

        status: "tentative",
        transparency: "opaque",
      },
    });

    console.log("GOOGLE EVENT RESTORED TO PROPOSAL");
  } catch {
    console.error("GOOGLE EVENT ROLLBACK AFTER REQUEST UPDATE FAILED");
  }

  // ------------------------------------------------
  // blocked_slot wieder entfernen
  // ------------------------------------------------
  const { error: blockedRollbackError } = await supabase
    .from("blocked_slots")
    .delete()
    .eq("id", blockedSlot.id);

  if (blockedRollbackError) {
    console.error("BLOCKED SLOT ROLLBACK AFTER REQUEST UPDATE FAILED");
  }

  return json(
    {
      error: "request_update_failed",
      detail: "INTERNAL_ERROR",
    },
    500
  );
}
    // ------------------------------------------------
// ------------------------------------------------
// ANDERE VORSCHLÄGE + GOOGLE-RESERVIERUNGEN LÖSCHEN
// ------------------------------------------------
const { data: otherProposals, error: otherProposalsError } =
  await supabase
    .from("appointment_proposals")
    .select("id, google_event_id")
    .eq("anfrage_id", requestId)
    .neq("id", proposalId);

if (otherProposalsError) {
  console.error("OTHER PROPOSALS LOAD FAILED");
} else {
  // ----------------------------------------------
  // zuerst Google-Events löschen
  // ----------------------------------------------
  for (const otherProposal of otherProposals || []) {
    if (!otherProposal.google_event_id) {
      console.warn("OTHER PROPOSAL WITHOUT GOOGLE EVENT");
      continue;
    }

    try {
      await calendar.events.delete({
        calendarId: bookingSettings.selected_calendar_id,
        eventId: otherProposal.google_event_id,
      });

      console.log("UNUSED GOOGLE PROPOSAL DELETED");
    } catch {
      console.error("UNUSED GOOGLE PROPOSAL DELETE FAILED");
    }
  }

  // ----------------------------------------------
  // danach die beiden DB-Proposals löschen
  // ----------------------------------------------
  const { error: delError } = await supabase
    .from("appointment_proposals")
    .delete()
    .eq("anfrage_id", requestId)
    .neq("id", proposalId);

  if (delError) {
    console.error("OTHER PROPOSALS DELETE FAILED");
  }
}
// ------------------------------------------------
// GEWÄHLTEN PROPOSAL-DATENSATZ ENTFERNEN
// Der bestätigte Termin lebt jetzt in
// anfragen + blocked_slots + Google Calendar
// ------------------------------------------------
const { error: selectedProposalDeleteError } =
  await supabase
    .from("appointment_proposals")
    .delete()
    .eq("id", proposalId);

if (selectedProposalDeleteError) {
  console.error("SELECTED PROPOSAL DELETE FAILED");
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
  Deinen Termin kannst du jederzeit selbst verwalten.
</p>

<p style="margin:24px 0;">
  <a
    href="${manageLink}"
    style="
      display:inline-block;
      background:#8E3A4A;
      color:white;
      padding:14px 22px;
      border-radius:10px;
      text-decoration:none;
      font-weight:600;
    "
  >
    Termin verwalten
  </a>
</p>

<p>
  Dort kannst du:
</p>

<ul>
  <li>Termin ansehen</li>
  <li>Termin ändern</li>
  <li>Termin absagen</li>
</ul>

<p>
  Falls du Probleme hast,
  erreichst du uns jederzeit unter
  <a href="mailto:hallo@mypoise.de">
    hallo@mypoise.de
  </a>.
</p>

            <p>
              Alles Liebe<br/>
              ${therapistName} 🤍
            </p>
          `,
        }),
      });

      console.log("📧 RESEND STATUS:", mailRes.status);
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
    console.error("CONFIRM ERROR");
    return json({ error: "server_error", detail: "INTERNAL_ERROR" }, 500);
  }
}
