export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { oauthClient } from "../../_lib/server";

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
function viennaLocalToUtc(value) {
  if (!value) return null;

  const raw = String(value).replace(" ", "T");
  const [datePart, timePartRaw] = raw.split("T");
  const timePart = (timePartRaw || "").slice(0, 5);

  if (!datePart || !timePart) return null;

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const localAsUTC = Date.UTC(year, month - 1, day, hour, minute, 0);

  function getViennaOffsetMs(utcMs) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Vienna",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(utcMs));

    const obj = {};
    for (const p of parts) obj[p.type] = p.value;

    return (
      Date.UTC(
        Number(obj.year),
        Number(obj.month) - 1,
        Number(obj.day),
        Number(obj.hour),
        Number(obj.minute),
        Number(obj.second)
      ) - utcMs
    );
  }

  let utcMs = localAsUTC - getViennaOffsetMs(localAsUTC);
  utcMs = localAsUTC - getViennaOffsetMs(utcMs);

  return new Date(utcMs).toISOString();
}
export async function POST(req) {
  try {
    const body = await req.json();
    console.log("📥 BODY:", body);

    const { requestId, therapist_id, proposals } = body;

    if (!requestId || !therapist_id || !Array.isArray(proposals)) {
      return json({ error: "missing_data" }, 400);
    }
// ------------------------------------------------
// POISE-GOOGLE-KONTO + KALENDER DES COACHS LADEN
// ------------------------------------------------
const { data: bookingSettings, error: bookingSettingsError } =
  await supabase
    .from("therapist_booking_settings")
    .select("selected_calendar_id, time_zone")
    .eq("therapist_id", therapist_id)
    .single();

if (bookingSettingsError || !bookingSettings) {
  console.error(
    "❌ BOOKING SETTINGS LOAD ERROR:",
    bookingSettingsError
  );

  return json(
    {
      error: "booking_settings_not_found",
    },
    400
  );
}

if (!bookingSettings.selected_calendar_id) {
  console.error(
    "❌ SELECTED CALENDAR ID MISSING:",
    therapist_id
  );

  return json(
    {
      error: "selected_calendar_id_missing",
    },
    400
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

const calendarId =
  bookingSettings.selected_calendar_id;

const timeZone =
  bookingSettings.time_zone || "Europe/Vienna";
    // ------------------------------------------------
    // Vorschläge vorbereiten
    // ------------------------------------------------
const expiresAt = new Date(
  Date.now() + 4 * 24 * 60 * 60 * 1000
).toISOString();


const rows = proposals
  .filter((p) => p.date)
  .map((p) => ({
    anfrage_id: requestId,
    therapist_id,
    date: viennaLocalToUtc(p.date),
    expires_at: expiresAt,
  }))
  .filter((row) => row.date);


    if (!rows.length) {
      return json({ error: "no_valid_dates" }, 400);
    }

// ------------------------------------------------
// ALTE VORSCHLÄGE + GOOGLE-RESERVIERUNGEN LÖSCHEN
// ------------------------------------------------
const { data: oldProposals, error: oldProposalsError } =
  await supabase
    .from("appointment_proposals")
    .select("id, google_event_id")
    .eq("anfrage_id", requestId);

if (oldProposalsError) {
  console.error(
    "❌ LOAD OLD PROPOSALS ERROR:",
    oldProposalsError
  );

  return json(
    {
      error: "old_proposals_load_failed",
      detail: oldProposalsError.message,
    },
    500
  );
}

for (const oldProposal of oldProposals || []) {
  if (!oldProposal.google_event_id) continue;

  try {
    await calendar.events.delete({
      calendarId,
      eventId: oldProposal.google_event_id,
    });

    console.log(
      "🗑️ OLD GOOGLE PROPOSAL DELETED:",
      oldProposal.google_event_id
    );
  } catch (err) {
    console.warn(
      "⚠️ OLD GOOGLE PROPOSAL DELETE FAILED:",
      oldProposal.google_event_id,
      err
    );
  }
}

const { error: deleteOldError } = await supabase
  .from("appointment_proposals")
  .delete()
  .eq("anfrage_id", requestId);

if (deleteOldError) {
  console.error(
    "❌ DELETE OLD PROPOSALS ERROR:",
    deleteOldError
  );

  return json(
    {
      error: "delete_old_proposals_failed",
      detail: deleteOldError.message,
    },
    500
  );
}

// ------------------------------------------------
// NEUE VORSCHLÄGE + GOOGLE-RESERVIERUNGEN ERSTELLEN
// ------------------------------------------------
const createdProposalIds = [];
const createdGoogleEventIds = [];

try {
  for (const row of rows) {
    const start = new Date(row.date);

    if (Number.isNaN(start.getTime())) {
      throw new Error("invalid_proposal_date");
    }

    // Aktuell 60 Minuten Erstgespräch
    const end = new Date(
      start.getTime() + 60 * 60 * 1000
    );

    // ----------------------------------------------
    // Google-Reservierung erstellen
    // ----------------------------------------------
    const googleEventRes =
      await calendar.events.insert({
        calendarId,

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
          transparency: "opaque",
          status: "tentative",
        },
      });

    const googleEventId =
      googleEventRes.data.id || null;

    if (!googleEventId) {
      throw new Error(
        "google_event_created_without_id"
      );
    }

    createdGoogleEventIds.push(googleEventId);

    // ----------------------------------------------
    // Proposal in Supabase speichern
    // ----------------------------------------------
    const {
      data: insertedProposal,
      error: insertError,
    } = await supabase
      .from("appointment_proposals")
      .insert({
        ...row,
        google_event_id: googleEventId,
      })
      .select("id")
      .single();

    if (insertError || !insertedProposal) {
      throw new Error(
        insertError?.message ||
          "proposal_insert_failed"
      );
    }

    createdProposalIds.push(insertedProposal.id);

    console.log("✅ PROPOSAL CREATED:", {
      proposalId: insertedProposal.id,
      googleEventId,
      date: row.date,
    });
  }
} catch (proposalCreateError) {
  console.error(
    "❌ PROPOSAL CREATE FAILED:",
    proposalCreateError
  );

  // Google-Events zurückrollen
  for (const eventId of createdGoogleEventIds) {
    try {
      await calendar.events.delete({
        calendarId,
        eventId,
      });
    } catch (rollbackError) {
      console.error(
        "❌ GOOGLE ROLLBACK FAILED:",
        rollbackError
      );
    }
  }

  // Supabase-Proposals zurückrollen
  if (createdProposalIds.length > 0) {
    const { error: rollbackDbError } =
      await supabase
        .from("appointment_proposals")
        .delete()
        .in("id", createdProposalIds);

    if (rollbackDbError) {
      console.error(
        "❌ DB ROLLBACK FAILED:",
        rollbackDbError
      );
    }
  }

  return json(
    {
      error: "proposal_creation_failed",
      detail: String(proposalCreateError),
    },
    500
  );
}
    // ------------------------------------------------
    // KLIENT:IN + COACH LADEN
    // ------------------------------------------------
const { data: request, error: reqError } = await supabase
  .from("anfragen")
  .select("email, vorname, wunschtherapeut, booking_token")
  .eq("id", requestId)
  .single();

if (reqError || !request?.email || !request?.booking_token) {
  console.error("❌ REQUEST LOAD ERROR:", reqError);

  return json(
    { error: "client_or_booking_token_missing" },
    500
  );
}

    // ------------------------------------------------
    // LINK BAUEN
    // ------------------------------------------------
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://app.mypoise.de";

const link =
  `${baseUrl}/confirm-proposal?token=${encodeURIComponent(
    request.booking_token
  )}`;
    const coachName = request.wunschtherapeut || "dein Coach";

    // ------------------------------------------------
    // MAIL SENDEN
    // ------------------------------------------------
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <hallo@mypoise.de>",
        to: request.email,
        subject: "Deine Terminvorschläge 🤍",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
            <h2 style="margin-bottom: 16px;">Deine Terminvorschläge 🤍</h2>

            <p>Hallo ${request.vorname || "du"},</p>

            <p>
              ich habe dir passende Terminvorschläge für unser Erstgespräch vorbereitet.
            </p>

            <p>
              Such dir gerne den Termin aus, der für dich am besten passt.
            </p>

            <p>
  Die Terminvorschläge sind für die nächsten 4 Tage gültig.
</p>

            <p style="margin: 24px 0;">
              <a
                href="${link}"
                style="
                  background:#111;
                  color:#fff;
                  padding:12px 18px;
                  border-radius:999px;
                  text-decoration:none;
                  display:inline-block;
                  font-weight:600;
                "
              >
                Terminvorschläge ansehen
              </a>
            </p>

            <p>
              Sobald du einen Termin ausgewählt hast, erhältst du anschließend noch eine separate Bestätigungsmail mit dem Link zum Erstgespräch.
            </p>

            <p>
              Falls du zu den vorgeschlagenen Zeiten keine Zeit hast oder sonst etwas nicht passt, melde dich bitte einfach unter
              <a href="mailto:hallo@mypoise.de">hallo@mypoise.de</a>.
            </p>

            <p style="margin-top: 24px;">
              Alles Liebe<br />
              ${coachName} 🤍
            </p>
          </div>
        `,
      }),
    });

if (!mailRes.ok) {
  const mailText = await mailRes.text();
  console.error("❌ MAIL ERROR:", mailText);

  return json({
    ok: true,
    warning: "proposal_saved_but_mail_failed",
    detail: mailText,
  });
}

console.log("✅ MAIL SENT TO:", request.email);

const sentAt = new Date().toISOString();

const { error: proposalStatusError } = await supabase
  .from("anfragen")
  .update({
    proposals_sent_at: sentAt,
    proposals_count: rows.length,

    // Reminder-/Ablaufstatus für diese neue Runde zurücksetzen
    proposal_reminder_1_at: null,
    proposal_reminder_2_at: null,
    proposals_expired_at: null,
    new_proposals_requested_at: null,
  })
  .eq("id", requestId);

if (proposalStatusError) {
  console.error(
    "❌ PROPOSAL STATUS UPDATE ERROR:",
    proposalStatusError
  );

  return json(
    {
      error: "proposal_status_update_failed",
      detail: proposalStatusError.message,
    },
    500
  );
}

return json({
  ok: true,
  proposals_sent_at: sentAt,
  proposals_count: rows.length,
});
  } catch (e) {
    console.error("SERVER ERROR:", e);
    return json({ error: "server_error", detail: String(e) }, 500);
  }
}
