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
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function normalizeIso(value) {
  if (!value) return null;

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return null;
  }

  return d.toISOString();
}

/**
 * Entfernt bereits erzeugte Daten, falls innerhalb
 * der Batch-Verarbeitung ein Fehler auftritt.
 */
async function rollbackCreatedEntries({
  createdSessions,
  createdBlockedSlots,
  createdGoogleEvents,
  calendar,
  calendarId,
}) {
  console.warn("⚠️ BATCH ROLLBACK START");

  /*
   * Google-Termine entfernen
   */
  if (calendar && calendarId) {
    for (const googleEventId of createdGoogleEvents) {
      try {
        await calendar.events.delete({
          calendarId,
          eventId: googleEventId,
        });

        console.log(
          "✅ ROLLBACK GOOGLE EVENT DELETED:",
          googleEventId
        );
      } catch (error) {
        const status =
          error?.response?.status ||
          error?.code ||
          null;

        if (
          Number(status) !== 404 &&
          Number(status) !== 410
        ) {
          console.error(
            "❌ ROLLBACK GOOGLE EVENT ERROR:",
            {
              googleEventId,
              error,
            }
          );
        }
      }
    }
  }

  /*
   * Blockierte Slots entfernen
   */
  if (createdBlockedSlots.length > 0) {
    const { error } = await supabase
      .from("blocked_slots")
      .delete()
      .in("id", createdBlockedSlots);

    if (error) {
      console.error(
        "❌ ROLLBACK BLOCKED SLOTS ERROR:",
        error
      );
    }
  }

  /*
   * Sitzungen entfernen
   */
  if (createdSessions.length > 0) {
    const { error } = await supabase
      .from("sessions")
      .delete()
      .in("id", createdSessions);

    if (error) {
      console.error(
        "❌ ROLLBACK SESSIONS ERROR:",
        error
      );
    }
  }

  console.warn("⚠️ BATCH ROLLBACK END");
}

export async function POST(req) {
  const createdSessions = [];
  const createdBlockedSlots = [];
  const createdGoogleEvents = [];

  let calendar = null;
  let selectedCalendarId = null;

  try {
    const body = await req.json();

    console.log(
      "📥 ADD SESSIONS BATCH BODY:",
      JSON.stringify(body, null, 2)
    );

    const {
      anfrageId,
      therapist,
      therapist_id,
      sessions,
    } = body || {};

    /* ===============================
       1️⃣ Eingabe prüfen
    =============================== */

    if (
      !anfrageId ||
      !therapist_id ||
      !Array.isArray(sessions)
    ) {
      return json(
        {
          error: "INVALID_INPUT",
          hint:
            "anfrageId, therapist_id oder sessions fehlt",
        },
        400
      );
    }

    const cleanSessions = sessions
      .map((session, index) => {
        const startISO =
          normalizeIso(session?.date);

        const durationMin =
          Number(session?.duration) || 60;

        const price =
          Number(session?.price) || 0;

        if (
          !startISO ||
          !Number.isFinite(durationMin) ||
          durationMin <= 0 ||
          !Number.isFinite(price)
        ) {
          return {
            valid: false,
            index,
          };
        }

        const endISO = new Date(
          new Date(startISO).getTime() +
            durationMin * 60 * 1000
        ).toISOString();

        return {
          valid: true,
          index,
          startISO,
          endISO,
          durationMin,
          price,
          commission: price * 0.3,
          payout: price * 0.7,
        };
      })
      .filter((session) => session.valid);

    if (cleanSessions.length === 0) {
      return json(
        {
          error: "NO_VALID_SESSIONS",
        },
        400
      );
    }

    /* ===============================
       2️⃣ Überschneidungen innerhalb
          des neuen Batches prüfen
    =============================== */

    const sortedSessions = [...cleanSessions].sort(
      (a, b) =>
        new Date(a.startISO).getTime() -
        new Date(b.startISO).getTime()
    );

    for (
      let index = 1;
      index < sortedSessions.length;
      index += 1
    ) {
      const previous =
        sortedSessions[index - 1];

      const current =
        sortedSessions[index];

      const previousEnd =
        new Date(previous.endISO).getTime();

      const currentStart =
        new Date(current.startISO).getTime();

      if (currentStart < previousEnd) {
        return json(
          {
            error:
              "BATCH_SESSIONS_OVERLAP",
            detail:
              "Zwei der neu eingetragenen Sitzungen überschneiden sich.",
            conflictingSessions: [
              previous,
              current,
            ],
          },
          409
        );
      }
    }

    /* ===============================
       3️⃣ Klient:in laden
    =============================== */

    const {
      data: anfrage,
      error: anfrageError,
    } = await supabase
      .from("anfragen")
      .select(`
        id,
        vorname,
        nachname,
        email,
        telefon,
        assigned_therapist_id
      `)
      .eq("id", anfrageId)
      .single();

    if (anfrageError || !anfrage) {
      console.error(
        "❌ BATCH ANFRAGE LOAD ERROR:",
        anfrageError
      );

      return json(
        {
          error: "REQUEST_NOT_FOUND",
          detail:
            anfrageError?.message || null,
        },
        404
      );
    }

    const clientName =
      `${anfrage.vorname || ""} ${
        anfrage.nachname || ""
      }`.trim() || "Klient:in";

    /* ===============================
       4️⃣ Kalender-Einstellungen laden
    =============================== */

    const {
      data: settings,
      error: settingsError,
    } = await supabase
      .from("therapist_booking_settings")
      .select(`
        selected_calendar_id,
        time_zone
      `)
      .eq("therapist_id", therapist_id)
      .single();

    if (
      settingsError ||
      !settings?.selected_calendar_id
    ) {
      console.error(
        "❌ BATCH BOOKING SETTINGS ERROR:",
        settingsError
      );

      return json(
        {
          error:
            "BOOKING_SETTINGS_NOT_FOUND",
          detail:
            settingsError?.message ||
            "Kein Google-Kalender ausgewählt",
        },
        400
      );
    }

    selectedCalendarId =
      settings.selected_calendar_id;

    const timeZone =
      settings.time_zone ||
      "Europe/Vienna";

    /* ===============================
       5️⃣ Google Calendar vorbereiten
    =============================== */

    const oauth = oauthClient();

    oauth.setCredentials({
      access_token:
        process.env.GOOGLE_ACCESS_TOKEN,
      refresh_token:
        process.env.GOOGLE_REFRESH_TOKEN,
    });

    calendar = google.calendar({
      version: "v3",
      auth: oauth,
    });

    const results = [];

    /* ===============================
       6️⃣ Jede Sitzung einzeln verarbeiten
    =============================== */

    for (const session of sortedSessions) {
      const {
        startISO,
        endISO,
        durationMin,
        price,
        commission,
        payout,
      } = session;

      console.log(
        "🔄 PROCESS BATCH SESSION:",
        {
          anfrageId,
          therapist_id,
          startISO,
          endISO,
          durationMin,
          price,
        }
      );

      /* -------------------------------
         6a. Überschneidung mit
             blocked_slots prüfen
      ------------------------------- */

      const {
        data: overlappingBlockedSlots,
        error: blockedOverlapError,
      } = await supabase
        .from("blocked_slots")
        .select(`
          id,
          start_at,
          end_at,
          reason
        `)
        .eq(
          "therapist_id",
          therapist_id
        )
        .lt("start_at", endISO)
        .gt("end_at", startISO)
        .limit(10);

      if (blockedOverlapError) {
        throw new Error(
          `BLOCKED_OVERLAP_CHECK_FAILED: ${blockedOverlapError.message}`
        );
      }

      if (
        overlappingBlockedSlots?.length >
        0
      ) {
        await rollbackCreatedEntries({
          createdSessions,
          createdBlockedSlots,
          createdGoogleEvents,
          calendar,
          calendarId:
            selectedCalendarId,
        });

        return json(
          {
            error:
              "SLOT_ALREADY_BOOKED",
            start: startISO,
            end: endISO,
            conflictingSlots:
              overlappingBlockedSlots,
          },
          409
        );
      }

      /* -------------------------------
         6b. Auch bestehende Sessions
             auf Überschneidung prüfen
      ------------------------------- */

      const rangeStart = new Date(
        new Date(startISO).getTime() -
          24 * 60 * 60 * 1000
      ).toISOString();

      const rangeEnd = new Date(
        new Date(endISO).getTime() +
          24 * 60 * 60 * 1000
      ).toISOString();

      const {
        data: nearbySessions,
        error: sessionsLoadError,
      } = await supabase
        .from("sessions")
        .select(`
          id,
          date,
          duration_min
        `)
        .eq(
          "therapist_id",
          therapist_id
        )
        .gte("date", rangeStart)
        .lte("date", rangeEnd);

      if (sessionsLoadError) {
        throw new Error(
          `SESSION_OVERLAP_CHECK_FAILED: ${sessionsLoadError.message}`
        );
      }

      const newStartMs =
        new Date(startISO).getTime();

      const newEndMs =
        new Date(endISO).getTime();

      const conflictingSession =
        (nearbySessions || []).find(
          (existingSession) => {
            const existingStartMs =
              new Date(
                existingSession.date
              ).getTime();

            const existingEndMs =
              existingStartMs +
              Number(
                existingSession.duration_min ||
                  0
              ) *
                60 *
                1000;

            return (
              existingStartMs < newEndMs &&
              existingEndMs > newStartMs
            );
          }
        );

      if (conflictingSession) {
        await rollbackCreatedEntries({
          createdSessions,
          createdBlockedSlots,
          createdGoogleEvents,
          calendar,
          calendarId:
            selectedCalendarId,
        });

        return json(
          {
            error:
              "SESSION_ALREADY_EXISTS",
            start: startISO,
            end: endISO,
            conflictingSession,
          },
          409
        );
      }

      /* -------------------------------
         6c. Sitzung speichern
      ------------------------------- */

      const {
        data: insertedSession,
        error: sessionInsertError,
      } = await supabase
        .from("sessions")
        .insert({
          anfrage_id: anfrageId,
          therapist:
            therapist || null,
          therapist_id,
          date: startISO,
          duration_min: durationMin,
          price,
          commission,
          payout,
        })
        .select()
        .single();

      if (
        sessionInsertError ||
        !insertedSession
      ) {
        throw new Error(
          `SESSION_INSERT_FAILED: ${
            sessionInsertError?.message ||
            "Unbekannter Fehler"
          }`
        );
      }

      createdSessions.push(
        insertedSession.id
      );

      /* -------------------------------
         6d. Slot sperren
      ------------------------------- */

      const {
        data: insertedBlockedSlot,
        error:
          blockedSlotInsertError,
      } = await supabase
        .from("blocked_slots")
        .insert({
          anfrage_id: anfrageId,
          therapist_id,
          start_at: startISO,
          end_at: endISO,
          reason: "session_booking",
        })
        .select()
        .single();

      if (
        blockedSlotInsertError ||
        !insertedBlockedSlot
      ) {
        throw new Error(
          `BLOCKED_SLOT_INSERT_FAILED: ${
            blockedSlotInsertError?.message ||
            "Unbekannter Fehler"
          }`
        );
      }

      createdBlockedSlots.push(
        insertedBlockedSlot.id
      );

      /* -------------------------------
         6e. Google-Kalendertermin
             erstellen
      ------------------------------- */

      const descriptionLines = [
        "Poise Sitzung",
        `Anfrage-ID: ${anfrageId}`,
        `Session-ID: ${insertedSession.id}`,
        `Klient: ${clientName}`,
        `E-Mail: ${anfrage.email || ""}`,
        `Telefon: ${
          anfrage.telefon || ""
        }`,
      ];

      const googleEventResponse =
        await calendar.events.insert({
          calendarId:
            selectedCalendarId,
          requestBody: {
            summary:
              `Poise Sitzung – ${clientName}`,
            description:
              descriptionLines.join("\n"),
            start: {
              dateTime: startISO,
              timeZone,
            },
            end: {
              dateTime: endISO,
              timeZone,
            },
          },
        });

      const googleEventId =
        googleEventResponse.data.id ||
        null;

      if (!googleEventId) {
        throw new Error(
          "GOOGLE_EVENT_CREATED_WITHOUT_ID"
        );
      }

      createdGoogleEvents.push(
        googleEventId
      );

      /* -------------------------------
         6f. Google-ID in sessions
             speichern
      ------------------------------- */

      const {
        error:
          sessionGoogleIdError,
      } = await supabase
        .from("sessions")
        .update({
          google_event_id:
            googleEventId,
        })
        .eq(
          "id",
          insertedSession.id
        );

      if (sessionGoogleIdError) {
        throw new Error(
          `SESSION_GOOGLE_ID_SAVE_FAILED: ${sessionGoogleIdError.message}`
        );
      }

      /* -------------------------------
         6g. Google-ID in
             blocked_slots speichern
      ------------------------------- */

      const {
        error:
          blockedGoogleIdError,
      } = await supabase
        .from("blocked_slots")
        .update({
          google_event_id:
            googleEventId,
        })
        .eq(
          "id",
          insertedBlockedSlot.id
        );

      if (blockedGoogleIdError) {
        throw new Error(
          `BLOCKED_GOOGLE_ID_SAVE_FAILED: ${blockedGoogleIdError.message}`
        );
      }

      results.push({
        sessionId:
          insertedSession.id,
        blockedSlotId:
          insertedBlockedSlot.id,
        googleEventId,
        start: startISO,
        end: endISO,
        durationMin,
        price,
      });

      console.log(
        "✅ BATCH SESSION CREATED:",
        results[results.length - 1]
      );
    }

    /* ===============================
       7️⃣ Erfolgreiche Antwort
    =============================== */

    return json({
      ok: true,
      count: results.length,
      sessions: results,
    });
  } catch (err) {
    console.error(
      "🔥 ADD SESSIONS BATCH ERROR:",
      err
    );

    await rollbackCreatedEntries({
      createdSessions,
      createdBlockedSlots,
      createdGoogleEvents,
      calendar,
      calendarId:
        selectedCalendarId,
    });

    return json(
      {
        error: "SERVER_ERROR",
        detail: String(err),
      },
      500
    );
  }
}
