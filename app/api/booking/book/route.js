export const dynamic = "force-dynamic";

import { google } from "googleapis";
import { Resend } from "resend";
import {
  json,
  oauthClient,
  supabaseAdmin,
} from "../../_lib/server";

function normalizeIso(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function POST(req) {
  try {
    console.log("=== BOOKING POST START ===");

    const sb = supabaseAdmin();
    const body = await req.json();
    console.log("BOOKING BODY:", JSON.stringify(body, null, 2));

    const resend = new Resend(process.env.RESEND_API_KEY);

    const token = body?.token || null;
    const googleEventIdFromBody = body?.googleEventId || null;
    const startFromBody = body?.start || null;
    const bookingType = body?.bookingType || "session";

    const durationMin =
      Number(body?.durationMin) ||
      (bookingType === "erstgespraech" ? 30 : 60);

    console.log("BOOKING INPUT PARSED:", {
      token,
      googleEventIdFromBody,
      startFromBody,
      bookingType,
      durationMin,
    });

    if (!token) {
      console.log("BOOKING FAIL: MISSING_TOKEN");
      return json({ error: "MISSING_TOKEN" }, 400);
    }

    if (!googleEventIdFromBody && !startFromBody) {
      console.log("BOOKING FAIL: MISSING_SLOT_REFERENCE");
      return json({ error: "MISSING_SLOT_REFERENCE" }, 400);
    }

    // 1) Anfrage laden
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
  status,
  booking_token,
  meeting_link_override
`)
      `)
      .eq("booking_token", token)
      .single();

    console.log("BOOKING ANFRAGE:", {
      anfrage,
      anfrageErr: anfrageErr?.message || null,
    });

    if (anfrageErr || !anfrage) {
      console.log("BOOKING FAIL: INVALID_TOKEN");
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
      console.log("BOOKING FAIL: NO_THERAPIST_ASSIGNED");
      return json({ error: "NO_THERAPIST_ASSIGNED" }, 400);
    }

    // 2) Booking Settings laden
    const { data: settings, error: settingsErr } = await sb
      .from("therapist_booking_settings")
      .select("*")
      .eq("therapist_id", therapistId)
      .single();

    console.log("BOOKING SETTINGS:", {
      settings,
      settingsErr: settingsErr?.message || null,
    });

    if (settingsErr || !settings) {
      console.log("BOOKING FAIL: BOOKING_SETTINGS_NOT_FOUND");
      return json(
        {
          error: "BOOKING_SETTINGS_NOT_FOUND",
          detail: settingsErr?.message || null,
        },
        400
      );
    }

    if (!settings.booking_enabled) {
      console.log("BOOKING FAIL: BOOKING_DISABLED");
      return json({ error: "BOOKING_DISABLED" }, 403);
    }

    if (!settings.selected_calendar_id) {
      console.log("BOOKING FAIL: NO_CALENDAR_SELECTED");
      return json({ error: "NO_CALENDAR_SELECTED" }, 400);
    }

    const oauth = oauthClient();

    oauth.setCredentials({
      access_token: process.env.GOOGLE_ACCESS_TOKEN,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    console.log("BOOKING GOOGLE CREDS PRESENT:", {
      hasAccessToken: !!process.env.GOOGLE_ACCESS_TOKEN,
      hasRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
    });

    // 4) Therapeut laden
    const { data: therapistMember, error: therapistErr } = await sb
      .from("team_members")
      .select("id, name, email")
      .eq("id", therapistId)
      .single();

    console.log("BOOKING THERAPIST:", {
      therapistMember,
      therapistErr: therapistErr?.message || null,
    });

    if (therapistErr || !therapistMember) {
      console.log("BOOKING FAIL: THERAPIST_NOT_FOUND");
      return json(
        {
          error: "THERAPIST_NOT_FOUND",
          detail: therapistErr?.message || null,
        },
        404
      );
    }

    const calendar = google.calendar({
      version: "v3",
      auth: oauth,
    });

    console.log("BOOKING CALENDAR READY:", {
      calendarId: settings.selected_calendar_id,
      timeZone: settings.time_zone || "Europe/Vienna",
    });

    // 6) Google Event finden
    let ev = null;
    let googleEventId = googleEventIdFromBody || null;

    if (googleEventIdFromBody) {
      console.log("BOOKING LOOKUP BY GOOGLE EVENT ID:", googleEventIdFromBody);

      try {
        const evRes = await calendar.events.get({
          calendarId: settings.selected_calendar_id,
          eventId: googleEventIdFromBody,
        });
        ev = evRes.data;

        console.log("BOOKING EVENT FOUND BY ID:", {
          id: ev?.id,
          summary: ev?.summary,
          start: ev?.start?.dateTime,
          end: ev?.end?.dateTime,
        });
      } catch (err) {
        console.error("BOOKING GOOGLE EVENT GET ERROR:", err);
        return json(
          {
            error: "GOOGLE_EVENT_NOT_FOUND",
            detail: String(err),
          },
          404
        );
      }
    } else {
      const wantedStartIso = normalizeIso(startFromBody);

      console.log("BOOKING LOOKUP BY START:", {
        startFromBody,
        wantedStartIso,
      });

      if (!wantedStartIso) {
        console.log("BOOKING FAIL: INVALID_START");
        return json({ error: "INVALID_START" }, 400);
      }

      const endSearchIso = new Date(
        new Date(wantedStartIso).getTime() + 2 * 60 * 60 * 1000
      ).toISOString();

      console.log("BOOKING GOOGLE LIST SEARCH:", {
        timeMin: wantedStartIso,
        timeMax: endSearchIso,
      });

      const listRes = await calendar.events.list({
        calendarId: settings.selected_calendar_id,
        timeMin: wantedStartIso,
        timeMax: endSearchIso,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 30,
      });

      const candidates = listRes.data.items || [];

      console.log(
        "BOOKING CANDIDATES:",
        candidates.map((item) => ({
          id: item?.id,
          summary: item?.summary,
          start: item?.start?.dateTime,
          end: item?.end?.dateTime,
        }))
      );

      ev =
        candidates.find((item) => {
          const title = String(item.summary || "").trim().toUpperCase();
          return (
            title.startsWith("POISE SLOT") &&
            normalizeIso(item?.start?.dateTime) === wantedStartIso
          );
        }) || null;

      console.log("BOOKING MATCHED EVENT:", {
        id: ev?.id,
        summary: ev?.summary,
        start: ev?.start?.dateTime,
        end: ev?.end?.dateTime,
      });

      if (!ev?.id) {
        console.log("BOOKING FAIL: slot_taken (no matching POISE SLOT found)");
        return json({ error: "slot_taken" }, 409);
      }

      googleEventId = ev.id;
    }

    const eventTitle = String(ev?.summary || "").trim().toUpperCase();

    console.log("BOOKING EVENT TITLE:", {
      eventTitle,
      originalSummary: ev?.summary,
    });

    if (!eventTitle.startsWith("POISE SLOT")) {
      console.log("BOOKING FAIL: SLOT_NOT_AVAILABLE");
      return json({ error: "SLOT_NOT_AVAILABLE" }, 409);
    }

    if (!ev?.start?.dateTime || !ev?.end?.dateTime) {
      console.log("BOOKING FAIL: INVALID_SLOT_EVENT", {
        start: ev?.start,
        end: ev?.end,
      });
      return json({ error: "INVALID_SLOT_EVENT" }, 400);
    }

    const originalStartISO = normalizeIso(ev.start.dateTime);
    if (!originalStartISO) {
      console.log("BOOKING FAIL: INVALID_SLOT_START");
      return json({ error: "INVALID_SLOT_START" }, 400);
    }

    const startISO = originalStartISO;
    const endISO = new Date(
      new Date(startISO).getTime() + durationMin * 60000
    ).toISOString();

    const clientName =
      `${anfrage.vorname || ""} ${anfrage.nachname || ""}`.trim() || "Klient";

    console.log("BOOKING FINAL SLOT:", {
      startISO,
      endISO,
      clientName,
      googleEventId,
    });

    // 7) Doppelbuchungsschutz
    if (bookingType === "erstgespraech") {
      const { data: existingBlocked, error: blockedErr } = await sb
        .from("blocked_slots")
        .select("id")
        .eq("therapist_id", therapistId)
        .eq("start_at", startISO);

      console.log("BOOKING BLOCKED SLOT CHECK:", {
        existingBlocked,
        blockedErr: blockedErr?.message || null,
      });

      if (blockedErr) {
        console.log("BOOKING FAIL: BLOCKED_CHECK_FAILED");
        return json(
          {
            error: "BLOCKED_CHECK_FAILED",
            detail: blockedErr.message,
          },
          500
        );
      }

      if ((existingBlocked || []).length > 0) {
        console.log("BOOKING FAIL: slot_taken (blocked slot exists)");
        return json({ error: "slot_taken" }, 409);
      }
    } else {
      const { data: existingSessions, error: existingErr } = await sb
        .from("sessions")
        .select("id")
        .eq("therapist_id", therapistId)
        .eq("date", startISO);

      console.log("BOOKING SESSION CHECK:", {
        existingSessions,
        existingErr: existingErr?.message || null,
      });

      if (existingErr) {
        console.log("BOOKING FAIL: SESSION_CHECK_FAILED");
        return json(
          {
            error: "SESSION_CHECK_FAILED",
            detail: existingErr.message,
          },
          500
        );
      }

      if ((existingSessions || []).length > 0) {
        console.log("BOOKING FAIL: slot_taken (session exists)");
        return json({ error: "slot_taken" }, 409);
      }
    }

    let insertedSession = null;

    // 8) DB-Logik je nach Typ
    if (bookingType === "erstgespraech") {
      const { error: blockErr } = await sb.from("blocked_slots").insert({
        anfrage_id: anfrage.id,
        therapist_id: therapistId,
        start_at: startISO,
        end_at: endISO,
        reason: "erstgespraech_booking",
      });

      console.log("BOOKING BLOCKED SLOT INSERT:", {
        blockErr: blockErr?.message || null,
      });

      if (blockErr) {
        console.log("BOOKING FAIL: BLOCKED_SLOT_INSERT_FAILED");
        return json(
          {
            error: "BLOCKED_SLOT_INSERT_FAILED",
            detail: blockErr.message,
          },
          400
        );
      }

      const { error: updateReqErr } = await sb
        .from("anfragen")
        .update({
          bevorzugte_zeit: startISO,
          status: "termin_bestaetigt",
          assigned_therapist_id: therapistId,
        })
        .eq("id", anfrage.id);

      console.log("BOOKING ANFRAGE UPDATE:", {
        updateReqErr: updateReqErr?.message || null,
        newStatus: "termin_bestaetigt",
        bevorzugte_zeit: startISO,
      });

      if (updateReqErr) {
        console.log("BOOKING FAIL: REQUEST_UPDATE_FAILED");
        return json(
          {
            error: "REQUEST_UPDATE_FAILED",
            detail: updateReqErr.message,
          },
          500
        );
      }
    } else {
      const price = anfrage.honorar_klient
        ? Number(anfrage.honorar_klient)
        : null;

      console.log("BOOKING SESSION INSERT TRY:", {
        anfrage_id: anfrage.id,
        therapist_id: therapistId,
        date: startISO,
        duration_min: durationMin,
        price,
      });

      const { data: inserted, error: sessionInsertErr } = await sb
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

      console.log("BOOKING SESSION INSERT RESULT:", {
        inserted,
        sessionInsertErr: sessionInsertErr?.message || null,
      });

      if (sessionInsertErr || !inserted) {
        console.log("BOOKING FAIL: SESSION_INSERT_FAILED");
        return json(
          {
            error: "SESSION_INSERT_FAILED",
            detail: sessionInsertErr?.message || null,
          },
          400
        );
      }

      insertedSession = inserted;

      const { error: statusErr } = await sb
        .from("anfragen")
        .update({
          status: "active",
        })
        .eq("id", anfrage.id);

      console.log("BOOKING STATUS UPDATE AFTER SESSION:", {
        statusErr: statusErr?.message || null,
      });

      if (statusErr) {
        console.error("BOOKING STATUS UPDATE FAILED:", statusErr);
      }
    }

    // 9) Google Event patchen
    try {
      const descriptionLines = [
        bookingType === "erstgespraech"
          ? "Poise Erstgespräch"
          : "Poise Sitzung",
        `Anfrage-ID: ${anfrage.id}`,
        `Klient: ${clientName}`,
        `E-Mail: ${anfrage.email || ""}`,
        `Telefon: ${anfrage.telefon || ""}`,
      ];

      if (insertedSession?.id) {
        descriptionLines.splice(2, 0, `Session-ID: ${insertedSession.id}`);
      }

      console.log("BOOKING GOOGLE PATCH PAYLOAD:", {
        calendarId: settings.selected_calendar_id,
        eventId: googleEventId,
        summary:
          bookingType === "erstgespraech"
            ? `Poise Erstgespräch – ${clientName}`
            : `Poise Sitzung – ${clientName}`,
        description: descriptionLines.join("\n"),
        startISO,
        endISO,
        timeZone: settings.time_zone || "Europe/Vienna",
      });

      await calendar.events.patch({
        calendarId: settings.selected_calendar_id,
        eventId: googleEventId,
        requestBody: {
          summary:
            bookingType === "erstgespraech"
              ? `Poise Erstgespräch – ${clientName}`
              : `Poise Sitzung – ${clientName}`,
          description: descriptionLines.join("\n"),
          start: {
            dateTime: startISO,
            timeZone: settings.time_zone || "Europe/Vienna",
          },
          end: {
            dateTime: endISO,
            timeZone: settings.time_zone || "Europe/Vienna",
          },
        },
      });

      console.log("BOOKING GOOGLE PATCH SUCCESS");
    } catch (googlePatchErr) {
      console.error("GOOGLE EVENT PATCH FAILED:", googlePatchErr);
      return json(
        {
          error: "GOOGLE_EVENT_PATCH_FAILED",
          detail: String(googlePatchErr),
        },
        500
      );
    }

    // 10) Mails
    try {
    const meetingLink =
  anfrage.meeting_link_override ||
  settings.meeting_link ||
  "";
      const startDate = new Date(startISO);
      const endDate = new Date(endISO);

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

      const endTimeString = endDate.toLocaleTimeString("de-AT", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: settings.time_zone || "Europe/Vienna",
      });

      const from = "Poise <noreply@mypoise.de>";

      console.log("BOOKING MAIL PREP:", {
        clientEmail: anfrage.email || null,
        therapistEmail: therapistMember?.email || null,
        dateString,
        timeString,
        endTimeString,
      });

if (anfrage.email) {
  const clientSubject =
    bookingType === "erstgespraech"
      ? "Dein kostenloses Poise Erstgespräch wurde gebucht 🤍"
      : "Dein Poise Termin wurde gebucht 🤍";

  await resend.emails.send({
    from,
    to: anfrage.email,
    subject: clientSubject,
    html: `
      <p>Hallo ${anfrage.vorname || ""},</p>

      <p>
        dein ${
          bookingType === "erstgespraech"
            ? "kostenloses Erstgespräch"
            : "Termin"
        } wurde erfolgreich gebucht.
      </p>

      <p>
        <strong>Datum:</strong> ${dateString}<br />
        <strong>Zeit:</strong> ${timeString} bis ${endTimeString}
      </p>

      ${
        meetingLink
          ? `
      <p>
        <strong>Dein Video-Link:</strong><br />
        <a href="${meetingLink}" target="_blank" style="color:#8E3A4A; font-weight:600;">
          Hier geht’s direkt zum Gespräch
        </a>
      </p>
      `
          : `
      <p>
        Der Link zum Gespräch wird dir rechtzeitig separat mitgeteilt.
      </p>
      `
      }

      <p>
        Bitte sei ein paar Minuten vor Beginn bereit und stelle sicher,
        dass Kamera, Mikrofon und Internetverbindung funktionieren.
      </p>

      <br />

      <p><strong>Termin ändern oder absagen</strong></p>

      <p>
        Falls du den Termin nicht wahrnehmen kannst oder Fragen dazu hast,
        melde dich bitte rechtzeitig bei uns unter:
      </p>

      <p>
        <strong>hallo@mypoise.de</strong>
      </p>

      <p>
        Wir kümmern uns schnell um eine Lösung und finden gemeinsam einen neuen Termin.
      </p>

      <p style="margin-top:12px;">
        Bitte gib uns möglichst früh Bescheid, falls du den Termin nicht wahrnehmen kannst.
      </p>

      <br />

      <p>Wir freuen uns auf dich 🤍</p>

      <p>Dein Poise-Team</p>
    `,
  });
}

        console.log("BOOKING CLIENT MAIL SENT");
      }

      if (therapistMember?.email) {
        const coachSubject =
          bookingType === "erstgespraech"
            ? "Neues Erstgespräch bei Poise"
            : "Neue Sitzung bei Poise";

        const coachTypeLabel =
          bookingType === "erstgespraech"
            ? "Erstgespräch"
            : "Sitzung";

        await resend.emails.send({
          from,
          to: therapistMember.email,
          subject: coachSubject,
          html: `
            <p>Hallo ${therapistMember.name || ""},</p>

            <p>Es wurde ein neuer Termin bei Poise gebucht.</p>

            <p>
              <strong>Typ:</strong> ${coachTypeLabel}<br />
              <strong>Klient:in:</strong> ${clientName || "–"}<br />
              <strong>E-Mail:</strong> ${anfrage.email || "–"}<br />
              <strong>Telefon:</strong> ${anfrage.telefon || "–"}<br />
              <strong>Datum:</strong> ${dateString}<br />
              <strong>Zeit:</strong> ${timeString} bis ${endTimeString}
            </p>

            <p>Poise Connect</p>
          `,
        });

        console.log("BOOKING COACH MAIL SENT");
      }
    } catch (mailErr) {
      console.error("BOOKING MAIL ERROR:", mailErr);
    }

    console.log("=== BOOKING POST SUCCESS ===", {
      bookingType,
      sessionId: insertedSession?.id || null,
      anfrageId: anfrage.id,
      therapistId,
      googleEventId,
      startISO,
      endISO,
    });

    return json({
      ok: true,
      bookingType,
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
