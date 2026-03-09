export const dynamic = "force-dynamic";

import { json, supabaseAdmin } from "../../_lib/server";
import { getTherapistContext, fetchGoogleBusyBlocks } from "../../_lib/slots";
import { addMinutes } from "date-fns";
import { google } from "googleapis";
import { oauthClient } from "../../_lib/server";

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export async function POST(req) {
  try {
    const sb = supabaseAdmin();
    const body = await req.json();

    const { token, startISO } = body; // client wählt start
    if (!token || !startISO) return json({ error: "MISSING_PARAMS" }, 400);

    const { data: anfrage, error: aErr } = await sb
      .from("anfragen")
      .select("id, vorname, nachname, email, assigned_therapist_id")
      .eq("booking_token", token)
      .single();

    if (aErr || !anfrage) return json({ error: "INVALID_TOKEN" }, 404);

    const therapistId = anfrage.assigned_therapist_id;
    if (!therapistId) return json({ error: "NO_THERAPIST_ASSIGNED" }, 400);

    const { settings, tokens } = await getTherapistContext(therapistId);
    if (!settings?.booking_enabled) return json({ error: "BOOKING_DISABLED" }, 403);

    const timeZone = settings.time_zone || "Europe/Vienna";
    const slotMin = Number(settings.slot_duration_min || 60);
    const bufferMin = Number(settings.buffer_min || 10);

    const start = new Date(startISO);
    const end = addMinutes(start, slotMin);
    const blockEnd = addMinutes(start, slotMin + bufferMin);

    // 1) finaler Busy-Check (Google)
    const busy = await fetchGoogleBusyBlocks(tokens, start.toISOString(), blockEnd.toISOString(), timeZone);
    const conflictGoogle = busy.some((b) => overlaps(start, blockEnd, b.start, b.end));
    if (conflictGoogle) return json({ error: "SLOT_TAKEN" }, 409);

    // 2) finaler DB-Check
    const { data: existing } = await sb
      .from("sessions")
      .select("id, date, duration_min")
      .eq("therapist_id", therapistId)
      .gte("date", addMinutes(start, -120).toISOString())
      .lte("date", addMinutes(blockEnd, 120).toISOString());

    const conflictDb = (existing || []).some((s) => {
      const sStart = new Date(s.date);
      const sEnd = new Date(sStart.getTime() + Number(s.duration_min || 60) * 60000);
      return overlaps(start, blockEnd, sStart, sEnd);
    });

    if (conflictDb) return json({ error: "SLOT_TAKEN" }, 409);

    // 3) Session anlegen (60 Min)
    const { data: inserted, error: insErr } = await sb
      .from("sessions")
      .insert({
        anfrage_id: anfrage.id,
        therapist_id: therapistId,
        date: start.toISOString(),
        duration_min: slotMin,
        price: null, // optional später
      })
      .select()
      .single();

    if (insErr) return json({ error: insErr.message }, 400);

    // 4) Google Event erstellen (70 Min block)
    if (tokens?.refresh_token || tokens?.access_token) {
      const oauth = oauthClient();
      oauth.setCredentials({
        access_token: tokens.access_token || undefined,
        refresh_token: tokens.refresh_token || undefined,
        expiry_date: tokens.expiry_date || undefined,
      });

      const calendar = google.calendar({ version: "v3", auth: oauth });

      await calendar.events.insert({
        calendarId: tokens.calendar_id || "primary",
        requestBody: {
          summary: `Poise Termin – ${anfrage.vorname} ${anfrage.nachname}`,
          description: `Anfrage: ${anfrage.id}\nE-Mail: ${anfrage.email}\nSession: ${inserted.id}`,
          start: { dateTime: start.toISOString(), timeZone },
          end: { dateTime: blockEnd.toISOString(), timeZone },
        },
      });
    }

    return json({ ok: true, session: inserted });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
