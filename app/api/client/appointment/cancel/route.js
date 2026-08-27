export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { oauthClient } from "../../../_lib/server";

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

export async function POST(req) {
  try {
    const { token } = await req.json();

    if (!token) {
      return json({ error: "missing_token" }, 400);
    }

    // ------------------------------------------------
    // 1. Anfrage über sicheren Token laden
    // ------------------------------------------------
    const { data: request, error: requestError } = await supabase
      .from("anfragen")
      .select(`
        id,
        vorname,
        nachname,
        email,
        assigned_therapist_id,
        status
      `)
      .eq("booking_token", token)
      .single();

    if (requestError || !request) {
      return json({ error: "invalid_token" }, 404);
    }

    if (!request.assigned_therapist_id) {
      return json({ error: "no_therapist_assigned" }, 400);
    }

    const therapistId = request.assigned_therapist_id;

    // ------------------------------------------------
    // 2. Kommenden Termin laden
    // ------------------------------------------------
    const nowIso = new Date().toISOString();

    const { data: blockedSlots, error: blockedLoadError } = await supabase
      .from("blocked_slots")
      .select(`
        id,
        start_at,
        end_at,
        google_event_id
      `)
      .eq("anfrage_id", request.id)
      .eq("therapist_id", therapistId)
      .gte("start_at", nowIso)
      .order("start_at", { ascending: true })
      .limit(1);

    if (blockedLoadError) {
      console.error("CANCEL BLOCK LOAD FAILED:", { code: blockedLoadError?.code || null });

      return json(
        {
          error: "appointment_load_failed",
          detail: blockedLoadError.message,
        },
        500
      );
    }

    const blockedSlot =
      Array.isArray(blockedSlots) && blockedSlots.length > 0
        ? blockedSlots[0]
        : null;

    if (!blockedSlot) {
      return json({ error: "no_upcoming_appointment" }, 404);
    }

    // ------------------------------------------------
    // 3. Booking-Settings + Coach laden
    // ------------------------------------------------
    const { data: bookingSettings, error: settingsError } = await supabase
      .from("therapist_booking_settings")
      .select(`
        selected_calendar_id,
        time_zone
      `)
      .eq("therapist_id", therapistId)
      .single();

    if (
      settingsError ||
      !bookingSettings?.selected_calendar_id
    ) {
      console.error("CANCEL SETTINGS LOAD FAILED:", { code: settingsError?.code || null });

      return json(
        {
          error: "booking_settings_not_found",
        },
        500
      );
    }

    const { data: coach, error: coachError } = await supabase
      .from("team_members")
      .select(`
        id,
        name,
        email
      `)
      .eq("id", therapistId)
      .single();

    if (coachError) {
      console.warn("CANCEL COACH LOAD FAILED:", { code: coachError?.code || null });
    }

    // ------------------------------------------------
    // 4. Google-Kliententermin löschen
    // POISE VERFÜGBAR wird NICHT verändert
    // ------------------------------------------------
    if (blockedSlot.google_event_id) {
      const oauth = oauthClient();

      oauth.setCredentials({
        access_token: process.env.GOOGLE_ACCESS_TOKEN,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      });

      const calendar = google.calendar({
        version: "v3",
        auth: oauth,
      });

      try {
        await calendar.events.delete({
          calendarId: bookingSettings.selected_calendar_id,
          eventId: blockedSlot.google_event_id,
        });
      } catch (googleDeleteError) {
        const googleStatus =
          googleDeleteError?.response?.status ||
          googleDeleteError?.code ||
          null;

        // Schon gelöscht = für uns okay
        if (
          Number(googleStatus) !== 404 &&
          Number(googleStatus) !== 410
        ) {
          console.error("CANCEL GOOGLE EVENT DELETE FAILED:", { code: googleDeleteError?.code || null });

          return json(
            {
              error: "google_event_delete_failed",
              detail: String(googleDeleteError),
            },
            500
          );
        }
      }
    }

    // ------------------------------------------------
    // 5. blocked_slot löschen
    // ------------------------------------------------
    const { error: blockedDeleteError } = await supabase
      .from("blocked_slots")
      .delete()
      .eq("id", blockedSlot.id);

    if (blockedDeleteError) {
      console.error("CANCEL BLOCKED SLOT DELETE FAILED:", { code: blockedDeleteError?.code || null });

      return json(
        {
          error: "blocked_slot_delete_failed",
          detail: blockedDeleteError.message,
        },
        500
      );
    }

    // ------------------------------------------------
    // 6. Anfrage zurücksetzen
    // ------------------------------------------------
    const { error: requestUpdateError } = await supabase
      .from("anfragen")
      .update({
        bevorzugte_zeit: null,
        status: "termin_neu",
      })
      .eq("id", request.id);

    if (requestUpdateError) {
      console.error(
        "CANCEL REQUEST UPDATE FAILED:",
        requestUpdateError
      );

      return json(
        {
          error: "request_update_failed",
          detail: requestUpdateError.message,
        },
        500
      );
    }

    // ------------------------------------------------
    // 7. Mails
    // ------------------------------------------------
    const startDate = new Date(blockedSlot.start_at);

    const terminText = startDate.toLocaleString("de-AT", {
      timeZone: bookingSettings.time_zone || "Europe/Vienna",
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const clientName =
      `${request.vorname || ""} ${request.nachname || ""}`.trim() ||
      "Klient:in";

    try {
      if (request.email) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Poise <noreply@mypoise.de>",
            to: request.email,
            subject: "Dein Termin wurde abgesagt 🤍",
            html: `
              <p>Hallo ${request.vorname || ""},</p>

              <p>
                dein Termin am <strong>${terminText}</strong>
                wurde erfolgreich abgesagt.
              </p>

              <p>
                Alles Liebe<br/>
                Poise 🤍
              </p>
            `,
          }),
        });
      }

      if (coach?.email) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Poise <noreply@mypoise.de>",
            to: coach.email,
            subject: "Termin wurde abgesagt 🤍",
            html: `
              <p>Hallo ${coach.name || ""},</p>

              <p>
                ${clientName} hat den Termin am
                <strong>${terminText}</strong>
                abgesagt.
              </p>

              <p>
                Liebe Grüße<br/>
                Poise Connect
              </p>
            `,
          }),
        });
      }
    } catch (mailError) {
      console.error("CANCEL MAIL FAILED");
    }

    return json({
      ok: true,
      cancelled: true,
    });
  } catch (err) {
    console.error("CLIENT CANCEL ROUTE ERROR");

    return json(
      {
        error: "server_error",
        detail: String(err),
      },
      500
    );
  }
}
