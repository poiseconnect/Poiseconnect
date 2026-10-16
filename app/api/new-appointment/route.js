export const dynamic = "force-dynamic";

import { google } from "googleapis";
import {
  canAccessAssignedRequest,
  getActiveTeamMember,
  oauthClient,
} from "../_lib/server";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function normalizeIso(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export async function POST(req) {
  try {
    const auth = await getActiveTeamMember(req);
    if (!auth.member) return json({ error: auth.error }, auth.status);
    if (!["admin", "therapist"].includes(auth.member.role)) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const body = await req.json();

    const { requestId, oldSlot } = body || {};

    /* ===============================
       1️⃣ Pflichtfelder prüfen
    =============================== */

    if (!requestId) {
      return json(
        {
          error: "missing_fields",
          hint: "requestId fehlt",
        },
        400
      );
    }

    const { data: requestRow, error: requestError } = await auth.supabase
      .from("anfragen")
      .select(
        "id, assigned_therapist_id, email, vorname, wunschtherapeut, booking_token, bevorzugte_zeit"
      )
      .eq("id", requestId)
      .maybeSingle();
    if (requestError) return json({ error: "REQUEST_LOAD_FAILED" }, 500);
    if (!requestRow) return json({ error: "REQUEST_NOT_FOUND" }, 404);
    if (!canAccessAssignedRequest(auth.member, requestRow.assigned_therapist_id)) {
      return json({ error: "NO_ACCESS" }, 403);
    }
    if (!requestRow.assigned_therapist_id) {
      return json({ error: "REQUEST_NOT_ASSIGNED" }, 409);
    }

    const therapistId = requestRow.assigned_therapist_id;
    const therapistName = requestRow.wunschtherapeut || "dein Coach";
    const client = requestRow.email;
    const vorname = requestRow.vorname || "";
    if (!client) return json({ error: "CLIENT_EMAIL_MISSING" }, 400);

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://app.mypoise.de";

    const oldStartIso = normalizeIso(oldSlot);

    /* ===============================
       2️⃣ Alten gebuchten Slot suchen
    =============================== */

    let blockedSlotQuery = auth.supabase
      .from("blocked_slots")
      .select(`
        id,
        anfrage_id,
        therapist_id,
        start_at,
        end_at,
        reason,
        google_event_id
      `)
      .eq("anfrage_id", requestId)
      .eq("therapist_id", therapistId)
      .order("start_at", {
        ascending: false,
      })
      .limit(1);

    /*
     * Wenn oldSlot vorhanden ist, suchen wir exakt
     * nach diesem gebuchten Termin.
     */
    if (oldStartIso) {
      blockedSlotQuery =
        blockedSlotQuery.eq("start_at", oldStartIso);
    }

    const {
      data: blockedSlots,
      error: blockedSlotLoadError,
    } = await blockedSlotQuery;

    if (blockedSlotLoadError) {
      console.error("BLOCKED SLOT LOAD ERROR:", { code: blockedSlotLoadError?.code || null });

      return json(
        {
          error: "blocked_slot_load_failed",
          detail: "INTERNAL_ERROR",
        },
        500
      );
    }

    const blockedSlot =
      Array.isArray(blockedSlots) && blockedSlots.length > 0
        ? blockedSlots[0]
        : null;

    console.log("OLD BLOCKED SLOT LOOKUP:", { found: !!blockedSlot });

    /* ===============================
       3️⃣ Konkreten Kliententermin
          aus Google Calendar löschen
    =============================== */

    if (blockedSlot?.google_event_id) {
      const {
        data: bookingSettings,
        error: bookingSettingsError,
      } = await auth.supabase
        .from("therapist_booking_settings")
        .select(`
          selected_calendar_id,
          time_zone
        `)
        .eq("therapist_id", therapistId)
        .single();

      if (
        bookingSettingsError ||
        !bookingSettings?.selected_calendar_id
      ) {
        console.error("BOOKING SETTINGS LOAD ERROR:", { code: bookingSettingsError?.code || null });

        return json(
          {
            error: "booking_settings_not_found",
            detail:
              "INTERNAL_ERROR",
          },
          500
        );
      }

      const oauth = oauthClient();

      oauth.setCredentials({
        access_token:
          process.env.GOOGLE_ACCESS_TOKEN,
        refresh_token:
          process.env.GOOGLE_REFRESH_TOKEN,
      });

      const calendar = google.calendar({
        version: "v3",
        auth: oauth,
      });

      try {
        await calendar.events.delete({
          calendarId:
            bookingSettings.selected_calendar_id,
          eventId:
            blockedSlot.google_event_id,
        });

        console.log("GOOGLE CLIENT EVENT DELETED");
      } catch (googleDeleteError) {
        const googleStatus =
          googleDeleteError?.response?.status ||
          googleDeleteError?.code ||
          null;

        /*
         * 404 oder 410 bedeutet:
         * Der Kalendertermin wurde bereits gelöscht.
         * Dann darf der Reschedule trotzdem weiterlaufen.
         */
        if (
          Number(googleStatus) !== 404 &&
          Number(googleStatus) !== 410
        ) {
          console.error("GOOGLE EVENT DELETE ERROR:", { code: googleDeleteError?.code || null });

          return json(
            {
              error:
                "google_event_delete_failed",
              detail: "INTERNAL_ERROR",
            },
            500
          );
        }

        console.warn("GOOGLE EVENT ALREADY MISSING:", { status: googleStatus });
      }
    } else {
      console.warn("GOOGLE EVENT ID MISSING FOR RESCHEDULE");
    }

    /* ===============================
       4️⃣ Nur die einzelne Sperre löschen

       Dadurch wird genau dieser Slot
       wieder frei buchbar.

       Der große Eintrag
       "POISE VERFÜGBAR"
       bleibt im Google-Kalender bestehen.
    =============================== */

    if (blockedSlot?.id) {
      const {
        error: blockedSlotDeleteError,
      } = await auth.supabase
        .from("blocked_slots")
        .delete()
        .eq("id", blockedSlot.id);

      if (blockedSlotDeleteError) {
        console.error("BLOCKED SLOT DELETE ERROR:", { code: blockedSlotDeleteError?.code || null });

        return json(
          {
            error:
              "blocked_slot_delete_failed",
              detail: "INTERNAL_ERROR",
          },
          500
        );
      }

      console.log("OLD SLOT RELEASED");
    } else {
      /*
       * Kein Abbruch:
       * Der Link kann trotzdem erneut versendet werden.
       */
      console.warn("BLOCKED SLOT MISSING FOR RESCHEDULE");
    }

    /* ===============================
       5️⃣ Anfrage zurücksetzen
    =============================== */

    const updatePayload = {
      status: "termin_neu",
      match_state: "reschedule",
      bevorzugte_zeit: null,
      assigned_therapist_id: therapistId,
      wunschtherapeut: therapistName,
    };

    const { data: updatedRequest, error: updateError } = await auth.supabase
      .from("anfragen")
      .update(updatePayload)
      .eq("id", requestId)
      .eq("assigned_therapist_id", therapistId)
      .select("id")
      .maybeSingle();

    if (updateError || !updatedRequest) {
      console.error("UPDATE REQUEST ERROR:", { code: updateError?.code || null });

      return json(
        {
          error: "update_failed",
          detail: "INTERNAL_ERROR",
        },
        500
      );
    }

    console.log("REQUEST UPDATED", { requestId });

    /* ===============================
       6️⃣ Neuen Buchungslink erstellen
    =============================== */

    const tokenQuery = requestRow.booking_token
      ? `&token=${encodeURIComponent(requestRow.booking_token)}` : "";
    const link =
      `${baseUrl}?resume=10` +
      `&anfrageId=${encodeURIComponent(
        requestId
      )}` +
      `&therapist=${encodeURIComponent(
        therapistName
      )}${tokenQuery}`;

    console.log("RESCHEDULE LINK CREATED");

    /* ===============================
       7️⃣ E-Mail versenden
    =============================== */

    const mailRes = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          from:
            "Poise <noreply@mypoise.de>",
          to: client,
          subject:
            "Bitte neuen Termin auswählen 🤍",
          html: `
            <p>Hallo ${vorname || ""},</p>

            <p>
              dein bisheriger Termin wurde aufgehoben.
              Bitte wähle über den folgenden Link einen neuen Termin:
            </p>

            <p>
              <a
                href="${link}"
                target="_blank"
                style="color:#8E3A4A; font-weight:600;"
              >
                👉 Neuen Termin auswählen
              </a>
            </p>

            <p>
              Falls etwas nicht funktioniert, melde dich jederzeit unter
              <strong>hallo@mypoise.de</strong>.
            </p>

            <br />

            <p>
              Alles Liebe<br/>
              ${therapistName} 🤍
            </p>
          `,
        }),
      }
    );

    if (!mailRes.ok) {
      console.error("RESCHEDULE MAIL FAILED");
      return json({ error: "RESCHEDULE_MAIL_FAILED", requestUpdated: true }, 502);
    }

    console.log("RESCHEDULE MAIL SENT");
    return json({
      ok: true,
      requestId,
      therapistName,
      therapistId,
      releasedSlot: blockedSlot
        ? {
            id: blockedSlot.id,
            start: blockedSlot.start_at,
            end: blockedSlot.end_at,
            googleEventId:
              blockedSlot.google_event_id ||
              null,
          }
        : null,
    });
  } catch (err) {
    console.error("NEW APPOINTMENT SERVER ERROR");

    return json(
      {
        error: "server_error",
        detail: "INTERNAL_ERROR",
      },
      500
    );
  }
}
