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

export async function GET(req) {
  try {
    // Optionaler Schutz für den Cron-Endpoint
    const authHeader = req.headers.get("authorization") || "";

    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return json({ error: "unauthorized" }, 401);
    }

    const now = new Date().toISOString();

    // ------------------------------------------------
    // ABGELAUFENE OFFENE PROPOSALS LADEN
    // ------------------------------------------------
    const { data: expiredProposals, error: loadError } =
      await supabase
        .from("appointment_proposals")
        .select(`
          id,
          anfrage_id,
          therapist_id,
          google_event_id,
          expires_at
        `)
        .lt("expires_at", now);

    if (loadError) {
      console.error(
        "❌ EXPIRED PROPOSALS LOAD FAILED:",
        loadError
      );

      return json(
        {
          error: "expired_proposals_load_failed",
          detail: "INTERNAL_ERROR",
        },
        500
      );
    }

    if (!expiredProposals?.length) {
      return json({
        ok: true,
        expired: 0,
        deletedGoogleEvents: 0,
      });
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

    let deletedGoogleEvents = 0;
    const proposalIdsToDelete = [];

    // ------------------------------------------------
    // JEDES ABGELAUFENE PROPOSAL VERARBEITEN
    // ------------------------------------------------
    for (const proposal of expiredProposals) {
      // Kalender-ID des Coaches laden
      const { data: bookingSettings, error: bookingSettingsError } =
        await supabase
          .from("therapist_booking_settings")
          .select("selected_calendar_id")
          .eq("therapist_id", proposal.therapist_id)
          .single();

      if (
        bookingSettingsError ||
        !bookingSettings?.selected_calendar_id
      ) {
        console.error(
          "❌ CALENDAR ID MISSING FOR EXPIRED PROPOSAL:",
          {
            proposalId: proposal.id,
            therapistId: proposal.therapist_id,
            error: bookingSettingsError,
          }
        );

        // Diesen Datensatz vorerst NICHT löschen,
        // damit wir ihn später erneut versuchen können.
        continue;
      }

      // Google-Reservierung löschen
      if (proposal.google_event_id) {
        try {
          await calendar.events.delete({
            calendarId:
              bookingSettings.selected_calendar_id,
            eventId: proposal.google_event_id,
          });

          deletedGoogleEvents += 1;

          console.log(
            "🗑️ EXPIRED GOOGLE PROPOSAL DELETED:",
            proposal.google_event_id
          );
        } catch (googleDeleteError) {
          // 404 = Event ist ohnehin schon weg.
          const status =
            googleDeleteError?.response?.status ||
            googleDeleteError?.code;

          if (status === 404) {
            console.warn(
              "⚠️ GOOGLE EVENT ALREADY GONE:",
              proposal.google_event_id
            );
          } else {
            console.error(
              "❌ EXPIRED GOOGLE EVENT DELETE FAILED:",
              {
                proposalId: proposal.id,
                googleEventId:
                  proposal.google_event_id,
                error: googleDeleteError,
              }
            );

            // Bei echtem Google-Fehler Datensatz behalten,
            // damit später erneut versucht wird.
            continue;
          }
        }
      }

      proposalIdsToDelete.push(proposal.id);
    }

    // ------------------------------------------------
    // ERFOLGREICH BEREINIGTE PROPOSALS AUS DB LÖSCHEN
    // ------------------------------------------------
    if (proposalIdsToDelete.length > 0) {
      const { error: deleteDbError } =
        await supabase
          .from("appointment_proposals")
          .delete()
          .in("id", proposalIdsToDelete);

      if (deleteDbError) {
        console.error(
          "❌ EXPIRED PROPOSALS DB DELETE FAILED:",
          deleteDbError
        );

        return json(
          {
            error: "expired_proposals_db_delete_failed",
            detail: "INTERNAL_ERROR",
          },
          500
        );
      }
    }

    return json({
      ok: true,
      expired: expiredProposals.length,
      deletedFromDatabase:
        proposalIdsToDelete.length,
      deletedGoogleEvents,
    });
  } catch (e) {
    console.error(
      "🔥 EXPIRE PROPOSALS CRON ERROR:",
      e
    );

    return json(
      {
        error: "server_error",
        detail: "INTERNAL_ERROR",
      },
      500
    );
  }
}
