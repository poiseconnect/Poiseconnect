export const dynamic = "force-dynamic";

import { google } from "googleapis";
import { addDays, format, parseISO } from "date-fns";
import {
  json,
  oauthClient,
  supabaseAdmin,
} from "../../_lib/server";

function isPoiseSlot(ev) {
  const title = String(ev.summary || "").trim().toUpperCase();
  return title.startsWith("POISE SLOT");
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const from = url.searchParams.get("from");
    const days = Number(url.searchParams.get("days") || 14);

    if (!token || !from) return json({ error: "MISSING_PARAMS" }, 400);

    const sb = supabaseAdmin();

    const { data: anfrage, error: aErr } = await sb
      .from("anfragen")
      .select("id, assigned_therapist_id")
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

    if (!settings?.booking_enabled) return json({ slots: [] });
    if (!settings?.selected_calendar_id) return json({ slots: [] });

    const { data: tokens } = await sb
      .from("therapist_google_tokens")
      .select("*")
      .eq("therapist_id", therapistId)
      .single();

    if (!tokens) return json({ slots: [] });

    const startDate = parseISO(from);
    const endDate = addDays(startDate, Math.min(Math.max(days, 1), 60));

    const oauth = oauthClient();
    oauth.setCredentials({
      access_token: tokens.access_token || undefined,
      refresh_token: tokens.refresh_token || undefined,
      expiry_date: tokens.expiry_date || undefined,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth });

    const res = await calendar.events.list({
      calendarId: settings.selected_calendar_id,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
    });

    const rawEvents = res.data.items || [];

    const slotEvents = rawEvents.filter((ev) => {
      if (!isPoiseSlot(ev)) return false;
      if (!ev.start?.dateTime || !ev.end?.dateTime) return false;
      return true;
    });

    const grouped = {};

    slotEvents.forEach((ev) => {
      const startISO = ev.start.dateTime;
      const endISO = ev.end.dateTime;
      const day = format(new Date(startISO), "yyyy-MM-dd");

      if (!grouped[day]) grouped[day] = [];

      grouped[day].push({
        googleEventId: ev.id,
        start: startISO,
        end: endISO,
      });
    });

    const slots = Object.entries(grouped).map(([day, arr]) => ({
      day,
      slots: arr,
    }));

    return json({
      therapist_id: therapistId,
      calendar_id: settings.selected_calendar_id,
      slots,
    });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
