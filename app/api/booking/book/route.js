export const dynamic = "force-dynamic";

import { google } from "googleapis";
import { Resend } from "resend";
import {
  json,
  oauthClient,
  supabaseAdmin,
} from "../../_lib/server";

export async function POST(req) {
  try {
    const sb = supabaseAdmin();
    const body = await req.json();
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { token, googleEventId } = body || {};

    if (!token || !googleEventId) {
      return json({ error: "MISSING_PARAMS" }, 400);
    }

    // 1) Anfrage über booking_token laden
    const { data: anfrage, error: anfrageErr } = await sb
      .from("anfragen")
      .select(`
        id,
        vorname,
        nachname,
        email,
        telefon,
        honorar_klient,
        assigned_therapist_id,
        status
      `)
      .eq("booking_token", token)
      .single();

    if (anfrageErr || !anfrage) {
      return json(
        {
          error: "INVALID_TOKEN",
          detail: anfrageErr?.message || null,
        },
        404
      );
    }

    const therapistId = anfrage.assigned_therapist_id;

    if (!therapistId) {
      return json({ error: "NO_THERAPIST_ASSIGNED" }, 400);
    }

    // 2) Booking Settings laden
    const { data: settings, error: settingsErr } = await sb
      .from("therapist_booking_settings")
      .select("*")
      .eq("therapist_id", therapistId)
      .single();

    if (settingsErr || !settings) {
      return json(
        {
          error: "BOOKING_SETTINGS_NOT_FOUND",
          detail: settingsErr?.message || null,
        },
        400
      );
    }

    if (!settings.booking_enabled) {
      return json({ error: "BOOKING_DISABLED" }, 403);
    }

    if (!settings.selected_calendar_id) {
      return json({ error: "NO_CALENDAR_SELECTED" }, 400);
    }

    // 3) Google Tokens laden
    const { data: tokens, error: tokenErr } = await sb
      .from("therapist_google_tokens")
      .select("*")
      .eq("therapist_id", therapistId)
      .single();

    if (tokenErr || !tokens) {
      return json(
        {
          error: "GOOGLE_NOT_CONNECTED",
          detail: tokenErr?.message || null,
        },
        400
      );
    }

    // 4) Therapeut laden (für Mail)
    const { data: therapistMember, error: therapistErr } = await sb
      .from("team_members")
      .select("id, name, email")
      .eq("id", therapistId)
      .single();

    if (therapistErr || !therapistMember) {
      return json(
        {
          error: "THERAPIST_NOT_FOUND",
          detail: therapistErr?.message || null,
        },
        404
      );
    }

    // 5) OAuth Client vorbereiten
    const oauth = oauthClient();
    oauth.setCredentials({
      access_token: tokens.access_token || undefined,
      refresh_token: tokens.refresh_token || undefined,
      expiry_date: tokens.expiry_date || undefined,
    });

    const calendar = google.calendar({
      version: "v3",
      auth: oauth,
    });

    // 6) Google Event live laden
    let ev;
    try {
      const evRes = await calendar.events.get({
        calendarId: settings.selected_calendar_id,
        eventId: googleEventId,
      });
      ev = evRes.data;
    } catch (err) {
      return json(
        {
          error: "GOOGLE_EVENT_NOT_FOUND",
          detail: String(err),
        },
        404
      );
    }

    const eventTitle = String(ev?.summary || "").trim().toUpperCase();

    // Nur POISE SLOT darf gebucht werden
    if (!eventTitle.startsWith("POISE SLOT")) {
      return json({ error: "SLOT_NOT_AVAILABLE" }, 409);
    }

    if (!ev?.start?.dateTime || !ev?.end?.dateTime) {
      return json({ error: "INVALID_SLOT_EVENT" }, 400);
    }

    const startISO = ev.start.dateTime;
    const endISO = ev.end.dateTime;

    // 7) Doppelbuchungsschutz in DB
    const { data: existingSessions, error: existingErr } = await sb
      .from("sessions")
      .select("id, date, therapist_id")
      .eq("therapist_id", therapistId)
      .eq("date", startISO);

    if (existingErr) {
      return json(
        {
          error: "SESSION_CHECK_FAILED",
          detail: existingErr.message,
        },
        500
      );
    }

    if ((existingSessions || []).length > 0) {
      return json({ error: "SLOT_ALREADY_BOOKED" }, 409);
    }

    // 8) Session anlegen
    const durationMin = Number(settings.slot_duration_min || 60);
    const price = anfrage.honorar_klient
      ? Number(anfrage.honorar_klient)
      : null;

    const { data: insertedSession, error: sessionInsertErr } = await sb
      .from("sessions")
      .insert({
        anfrage_id: anfrage.id,
        therapist_id: therapistId,
        date: startISO,
        duration_min: durationMin,
        price,
      })
      .select()
      .single();

    if (sessionInsertErr || !insertedSession) {
      return json(
        {
          error: "SESSION_INSERT_FAILED",
          detail: sessionInsertErr?.message || null,
        },
        400
      );
    }

    // 9) Anfrage-Status auf active setzen
    const { error: statusErr } = await sb
      .from("anfragen")
      .update({
        status: "active",
      })
      .eq("id", anfrage.id);

    if (statusErr) {
      console.error("BOOKING STATUS UPDATE FAILED:", statusErr);
      // Kein Hard-Fail – Buchung war erfolgreich
    }

    // 10) Google Event umbenennen / markieren als gebucht
    const clientName =
      `${anfrage.vorname || ""} ${anfrage.nachname || ""}`.trim() ||
      "Klient";

    try {
      await calendar.events.patch({
        calendarId: settings.selected_calendar_id,
        eventId: googleEventId,
        requestBody: {
          summary: `Gebucht – ${clientName}`,
          description:
            `Poise Buchung\n` +
            `Anfrage-ID: ${anfrage.id}\n` +
            `Session-ID: ${insertedSession.id}\n` +
            `Klient: ${clientName}\n` +
            `E-Mail: ${anfrage.email || ""}\n` +
            `Telefon: ${anfrage.telefon || ""}`,
        },
      });
    } catch (googlePatchErr) {
      console.error("GOOGLE EVENT PATCH FAILED:", googlePatchErr);
      return json(
        {
          error: "GOOGLE_EVENT_PATCH_FAILED",
          detail: String(googlePatchErr),
          session: insertedSession,
        },
        500
      );
    }

    // 11) Bestätigungsmails senden
    try {
      const startDate = new Date(startISO);

      const dateString = startDate.toLocaleDateString("de-AT", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: settings.time_zone || "Europe/Vienna",
      });

      const timeString = startDate.toLocaleTimeString("de-AT", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: settings.time_zone || "Europe/Vienna",
      });

      const from = "Poise <noreply@mypoise.de>";

      if (anfrage.email) {
        const clientMailResult = await resend.emails.send({
          from,
          to: anfrage.email,
          subject: "Dein Poise Termin wurde gebucht 🤍",
          html: `
            <p>Hallo ${anfrage.vorname || ""},</p>

            <p>dein Termin wurde erfolgreich gebucht.</p>

            <p>
              <strong>Datum:</strong> ${dateString}<br />
              <strong>Uhrzeit:</strong> ${timeString}
            </p>

            <p>Wir freuen uns auf dich 🤍</p>

            <p>Dein Poise-Team</p>
          `,
        });

        console.log("CLIENT MAIL RESULT:", clientMailResult);
      }

      if (therapistMember?.email) {
        const therapistMailResult = await resend.emails.send({
          from,
          to: therapistMember.email,
          subject: "Neue Terminbuchung bei Poise",
          html: `
            <p>Hallo ${therapistMember.name || ""},</p>

            <p>ein neuer Termin wurde gebucht.</p>

            <p>
              <strong>Klient:in:</strong> ${clientName || "–"}<br />
              <strong>E-Mail:</strong> ${anfrage.email || "–"}<br />
              <strong>Telefon:</strong> ${anfrage.telefon || "–"}<br />
              <strong>Datum:</strong> ${dateString}<br />
              <strong>Uhrzeit:</strong> ${timeString}
            </p>

            <p>Poise Connect</p>
          `,
        });

        console.log("THERAPIST MAIL RESULT:", therapistMailResult);
      }
    } catch (mailErr) {
      console.error("BOOKING MAIL ERROR:", mailErr);
      // Kein Hard-Fail – Buchung selbst war erfolgreich
    }

    // 12) Erfolgreiche Antwort
    return json({
      ok: true,
      session: insertedSession,
      booking: {
        anfrage_id: anfrage.id,
        therapist_id: therapistId,
        google_event_id: googleEventId,
        start: startISO,
        end: endISO,
      },
    });
  } catch (err) {
    console.error("BOOKING BOOK ROUTE ERROR:", err);
    return json(
      {
        error: "SERVER_ERROR",
        detail: String(err),
      },
      500
    );
  }
}
