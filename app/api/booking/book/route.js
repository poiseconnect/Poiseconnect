export const dynamic = "force-dynamic";

import { google } from "googleapis";
import {
  json,
  oauthClient,
  supabaseAdmin,
} from "../../_lib/server";

export async function POST(req) {
  try {
    const sb = supabaseAdmin();
    const body = await req.json();

    const { token, googleEventId } = body;

    if (!token || !googleEventId) {
      return json({ error: "MISSING_PARAMS" }, 400);
    }

    const { data: anfrage, error: aErr } = await sb
      .from("anfragen")
      .select(`
        id,
        vorname,
        nachname,
        email,
        honorar_klient,
        assigned_therapist_id
      `)
      .eq("booking_token", token)
      .single();

    if (aErr || !anfrage) return json({ error: "INVALID_TOKEN" }, 404);

    const therapistId = anfrage.assigned_therapist_id;
    if (!therapistId) return json({ error: "NO_THERAPIST_ASSIGNED" }, 400);

    const { data: settings } = await sb
      .from("therapist_booking_settings")
      .select("*")
      .eq("therapist_id", therapistId)
      .single();

    if (!settings?.booking_enabled) {
      return json({ error: "BOOKING_DISABLED" }, 403);
    }

    if (!settings?.selected_calendar_id) {
      return json({ error: "NO_CALENDAR_SELECTED" }, 400);
    }

    const { data: tokens } = await sb
      .from("therapist_google_tokens")
      .select("*")
      .eq("therapist_id", therapistId)
      .single();

    if (!tokens) return json({ error: "GOOGLE_NOT_CONNECTED" }, 400);

    const oauth = oauthClient();
    oauth.setCredentials({
      access_token: tokens.access_token || undefined,
      refresh_token: tokens.refresh_token || undefined,
      expiry_date: tokens.expiry_date || undefined,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth });

    // 1) Event nochmal live laden
    const evRes = await calendar.events.get({
      calendarId: settings.selected_calendar_id,
      eventId: googleEventId,
    });

    const ev = evRes.data;

    const title = String(ev.summary || "").trim().toUpperCase();
    if (!title.startsWith("POISE SLOT")) {
      return json({ error: "SLOT_NOT_AVAILABLE" }, 409);
    }

    if (!ev.start?.dateTime || !ev.end?.dateTime) {
      return json({ error: "INVALID_SLOT_EVENT" }, 400);
    }

    const startISO = ev.start.dateTime;
    const endISO = ev.end.dateTime;

    // 2) DB check: gleiche Session schon vorhanden?
    const { data: existing } = await sb
      .from("sessions")
      .select("id")
      .eq("therapist_id", therapistId)
      .eq("date", startISO);

    if ((existing || []).length > 0) {
      return json({ error: "SLOT_ALREADY_BOOKED" }, 409);
    }

    // 3) Session anlegen
    const durationMin = Number(settings.slot_duration_min || 60);
    const price = anfrage.honorar_klient ? Number(anfrage.honorar_klient) : null;

    const { data: inserted, error: insErr } = await sb
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

    if (insErr) return json({ error: insErr.message }, 400);

    // 4) Google Event umbenennen
    const clientName = `${anfrage.vorname || ""} ${anfrage.nachname || ""}`.trim();

    await calendar.events.patch({
      calendarId: settings.selected_calendar_id,
      eventId: googleEventId,
      requestBody: {
        summary: `Gebucht – ${clientName}`,
        description:
          `Poise Buchung\n` +
          `Anfrage-ID: ${anfrage.id}\n` +
          `Session-ID: ${inserted.id}\n` +
          `E-Mail: ${anfrage.email || ""}`,
      },
    });

    return json({
      ok: true,
      session: inserted,
    });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
