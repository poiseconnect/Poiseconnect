export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { oauthClient } from "../_lib/server";

// -----------------------------------------
// Supabase SERVER Client
// -----------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function normalizeIso(value) {
  if (!value) return null;

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return null;
  }

  return d.toISOString();
}

// -----------------------------------------
// POST: EINZELNE SITZUNG
// -----------------------------------------
export async function POST(req) {
  let insertedSessionId = null;
  let insertedBlockedSlotId = null;
  let bookedGoogleEventId = null;
  let selectedCalendarId = null;

  try {
    const body = await req.json();

    console.log("ADD-SESSION BODY:", body);

    const {
      anfrageId,
      therapist,
      therapist_id,
      date,
      duration,
      price,
    } = body || {};

    /* -----------------------------------------
       1. Pflichtfelder prüfen
    ----------------------------------------- */

    if (
      !anfrageId ||
      !therapist_id ||
      !date ||
      !duration ||
      price == null
    ) {
      return json(
        {
          error: "MISSING_FIELDS",
          hint:
            "anfrageId, therapist_id, date, duration oder price fehlt",
        },
        400
      );
    }

    const safeDate = normalizeIso(date);
    const durationMin = Number(duration);
    const p = Number(price);

    if (!safeDate) {
      return json({ error: "INVALID_DATE" }, 400);
    }

    if (
      !Number.isFinite(durationMin) ||
      durationMin <= 0
    ) {
      return json({ error: "INVALID_DURATION" }, 400);
    }

    if (!Number.isFinite(p)) {
      return json({ error: "INVALID_PRICE" }, 400);
    }

    const startISO = safeDate;

    const endISO = new Date(
      new Date(startISO).getTime() +
        durationMin * 60 * 1000
    ).toISOString();

    const commission = p * 0.3;
    const payout = p * 0.7;

    console.log("ADD-SESSION NORMALIZED:", {
      anfrageId,
      therapist_id,
      startISO,
      endISO,
      durationMin,
      price: p,
    });

    /* -----------------------------------------
       2. Anfrage und Klient:in laden
    ----------------------------------------- */

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
        "ADD SESSION REQUEST LOAD ERROR:",
        anfrageError
      );

      return json(
        {
          error: "REQUEST_NOT_FOUND",
          detail: anfrageError?.message || null,
        },
        404
      );
    }

    const clientName =
      `${anfrage.vorname || ""} ${
        anfrage.nachname || ""
      }`.trim() || "Klient:in";

    /* -----------------------------------------
       3. Booking-Einstellungen des Coaches laden
    ----------------------------------------- */

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
        "ADD SESSION BOOKING SETTINGS ERROR:",
        settingsError
      );

      return json(
        {
          error: "BOOKING_SETTINGS_NOT_FOUND",
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
      settings.time_zone || "Europe/Vienna";

    /* -----------------------------------------
       4. Prüfen, ob es eine Überschneidung gibt

       Überschneidung:
       bestehender Start < neuer Endzeitpunkt
       UND
       bestehendes Ende > neuer Startzeitpunkt
    ----------------------------------------- */

    const {
      data: overlappingBlockedSlots,
      error: overlapError,
    } = await supabase
      .from("blocked_slots")
      .select(`
        id,
        start_at,
        end_at,
        reason
      `)
      .eq("therapist_id", therapist_id)
      .lt("start_at", endISO)
      .gt("end_at", startISO)
      .limit(10);

    if (overlapError) {
      console.error(
        "ADD SESSION OVERLAP CHECK ERROR:",
        overlapError
      );

      return json(
        {
          error: "OVERLAP_CHECK_FAILED",
          detail: overlapError.message,
        },
        500
      );
    }

    if (
      Array.isArray(overlappingBlockedSlots) &&
      overlappingBlockedSlots.length > 0
    ) {
      console.warn(
        "ADD SESSION SLOT ALREADY BLOCKED:",
        overlappingBlockedSlots
      );

      return json(
        {
          error: "SLOT_ALREADY_BOOKED",
          conflictingSlots:
            overlappingBlockedSlots,
        },
        409
      );
    }

    /* -----------------------------------------
       5. Zusätzlich Sitzungsüberschneidung prüfen
    ----------------------------------------- */

    const {
      data: possibleSessions,
      error: sessionOverlapError,
    } = await supabase
      .from("sessions")
      .select(`
        id,
        date,
        duration_min
      `)
      .eq("therapist_id", therapist_id)
      .gte(
        "date",
        new Date(
          new Date(startISO).getTime() -
            24 * 60 * 60 * 1000
        ).toISOString()
      )
      .lte(
        "date",
        new Date(
          new Date(endISO).getTime() +
            24 * 60 * 60 * 1000
        ).toISOString()
      );

    if (sessionOverlapError) {
      console.error(
        "ADD SESSION SESSION OVERLAP LOAD ERROR:",
        sessionOverlapError
      );

      return json(
        {
          error: "SESSION_OVERLAP_CHECK_FAILED",
          detail: sessionOverlapError.message,
        },
        500
      );
    }

    const conflictingSession =
      (possibleSessions || []).find((session) => {
        const existingStart =
          new Date(session.date).getTime();

        const existingEnd =
          existingStart +
          Number(session.duration_min || 0) *
            60 *
            1000;

        const newStart =
          new Date(startISO).getTime();

        const newEnd =
          new Date(endISO).getTime();

        return (
          existingStart < newEnd &&
          existingEnd > newStart
        );
      });

    if (conflictingSession) {
      return json(
        {
          error: "SESSION_ALREADY_EXISTS",
          conflictingSession,
        },
        409
      );
    }

    /* -----------------------------------------
       6. Sitzung zunächst in sessions speichern
    ----------------------------------------- */

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
        price: p,
        commission,
        payout,
      })
      .select()
      .single();

    if (
      sessionInsertError ||
      !insertedSession
    ) {
      console.error(
        "ADD SESSION INSERT ERROR:",
        sessionInsertError
      );

      return json(
        {
          error: "SESSION_FAILED",
          detail:
            sessionInsertError?.message ||
            "Sitzung konnte nicht gespeichert werden",
        },
        500
      );
    }

    insertedSessionId = insertedSession.id;

    console.log("ADD SESSION INSERTED:", {
      insertedSessionId,
    });

    /* -----------------------------------------
       7. Slot in blocked_slots sperren
    ----------------------------------------- */

    const {
      data: insertedBlockedSlot,
      error: blockedSlotInsertError,
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
      console.error(
        "ADD SESSION BLOCKED SLOT ERROR:",
        blockedSlotInsertError
      );

      // Rollback: Sitzung wieder entfernen
      await supabase
        .from("sessions")
        .delete()
        .eq("id", insertedSessionId);

      insertedSessionId = null;

      return json(
        {
          error: "BLOCKED_SLOT_FAILED",
          detail:
            blockedSlotInsertError?.message ||
            "Slot konnte nicht gesperrt werden",
        },
        500
      );
    }

    insertedBlockedSlotId =
      insertedBlockedSlot.id;

    console.log("ADD SESSION SLOT BLOCKED:", {
      insertedBlockedSlotId,
      startISO,
      endISO,
    });

    /* -----------------------------------------
       8. Eigenen Google-Kalendertermin erstellen

       Der große Eintrag "POISE VERFÜGBAR"
       wird NICHT verändert.
    ----------------------------------------- */

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

    const descriptionLines = [
      "Poise Sitzung",
      `Anfrage-ID: ${anfrageId}`,
      `Session-ID: ${insertedSessionId}`,
      `Klient: ${clientName}`,
      `E-Mail: ${anfrage.email || ""}`,
      `Telefon: ${anfrage.telefon || ""}`,
    ];

    try {
      const googleEventResponse =
        await calendar.events.insert({
          calendarId: selectedCalendarId,
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

      bookedGoogleEventId =
        googleEventResponse.data.id || null;

      if (!bookedGoogleEventId) {
        throw new Error(
          "Google Event wurde erstellt, aber ohne Event-ID zurückgegeben"
        );
      }

      console.log(
        "ADD SESSION GOOGLE EVENT CREATED:",
        {
          bookedGoogleEventId,
          startISO,
          endISO,
        }
      );
    } catch (googleInsertError) {
      console.error(
        "ADD SESSION GOOGLE EVENT ERROR:",
        googleInsertError
      );

      // Rollback: blocked_slot entfernen
      if (insertedBlockedSlotId) {
        await supabase
          .from("blocked_slots")
          .delete()
          .eq("id", insertedBlockedSlotId);
      }

      // Rollback: session entfernen
      if (insertedSessionId) {
        await supabase
          .from("sessions")
          .delete()
          .eq("id", insertedSessionId);
      }

      return json(
        {
          error: "GOOGLE_EVENT_FAILED",
          detail: String(googleInsertError),
        },
        500
      );
    }

    /* -----------------------------------------
       9. Google-Event-ID in sessions speichern
    ----------------------------------------- */

    const {
      error: sessionGoogleIdError,
    } = await supabase
      .from("sessions")
      .update({
        google_event_id:
          bookedGoogleEventId,
      })
      .eq("id", insertedSessionId);

    if (sessionGoogleIdError) {
      console.error(
        "ADD SESSION GOOGLE ID SAVE IN SESSION ERROR:",
        sessionGoogleIdError
      );

      /*
       * Der Termin existiert bereits korrekt.
       * Daher hier nicht alles löschen, sondern Fehler melden.
       */
      return json(
        {
          error:
            "SESSION_GOOGLE_EVENT_ID_SAVE_FAILED",
          detail:
            sessionGoogleIdError.message,
          sessionId: insertedSessionId,
          googleEventId:
            bookedGoogleEventId,
        },
        500
      );
    }

    /* -----------------------------------------
       10. Google-Event-ID in blocked_slots speichern
    ----------------------------------------- */

    const {
      error: blockedGoogleIdError,
    } = await supabase
      .from("blocked_slots")
      .update({
        google_event_id:
          bookedGoogleEventId,
      })
      .eq("id", insertedBlockedSlotId);

    if (blockedGoogleIdError) {
      console.error(
        "ADD SESSION GOOGLE ID SAVE IN BLOCKED SLOT ERROR:",
        blockedGoogleIdError
      );

      return json(
        {
          error:
            "BLOCKED_SLOT_GOOGLE_EVENT_ID_SAVE_FAILED",
          detail:
            blockedGoogleIdError.message,
          sessionId: insertedSessionId,
          blockedSlotId:
            insertedBlockedSlotId,
          googleEventId:
            bookedGoogleEventId,
        },
        500
      );
    }

    /* -----------------------------------------
       11. Erfolgreiche Antwort
    ----------------------------------------- */

    console.log("ADD SESSION SUCCESS:", {
      sessionId: insertedSessionId,
      blockedSlotId: insertedBlockedSlotId,
      googleEventId: bookedGoogleEventId,
      startISO,
      endISO,
    });

    return json({
      ok: true,
      session: {
        id: insertedSessionId,
        anfrage_id: anfrageId,
        therapist_id,
        date: startISO,
        duration_min: durationMin,
        price: p,
        commission,
        payout,
        google_event_id:
          bookedGoogleEventId,
      },
      blockedSlot: {
        id: insertedBlockedSlotId,
        start_at: startISO,
        end_at: endISO,
        reason: "session_booking",
        google_event_id:
          bookedGoogleEventId,
      },
    });
  } catch (err) {
    console.error(
      "ADD SESSION SERVER ERROR:",
      err
    );

    /*
     * Letzter Sicherheits-Rollback,
     * falls der Fehler nach dem Google-Insert auftritt.
     */
    try {
      if (
        bookedGoogleEventId &&
        selectedCalendarId
      ) {
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

        await calendar.events.delete({
          calendarId:
            selectedCalendarId,
          eventId:
            bookedGoogleEventId,
        });
      }
    } catch (rollbackGoogleError) {
      console.error(
        "ADD SESSION GOOGLE ROLLBACK ERROR:",
        rollbackGoogleError
      );
    }

    try {
      if (insertedBlockedSlotId) {
        await supabase
          .from("blocked_slots")
          .delete()
          .eq("id", insertedBlockedSlotId);
      }

      if (insertedSessionId) {
        await supabase
          .from("sessions")
          .delete()
          .eq("id", insertedSessionId);
      }
    } catch (rollbackDbError) {
      console.error(
        "ADD SESSION DB ROLLBACK ERROR:",
        rollbackDbError
      );
    }

    return json(
      {
        error: "SERVER_ERROR",
        detail: String(err),
      },
      500
    );
  }
}
