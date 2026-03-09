export const dynamic = "force-dynamic";

import { json, supabaseAdmin } from "../../_lib/server";
import { getTherapistContext, fetchGoogleBusyBlocks, generateDaySlots } from "../../_lib/slots";
import { addDays, format, parseISO } from "date-fns";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const bookingToken = url.searchParams.get("token");
    const from = url.searchParams.get("from"); // YYYY-MM-DD
    const days = Number(url.searchParams.get("days") || 30);

    if (!bookingToken || !from) return json({ error: "MISSING_PARAMS" }, 400);

    const sb = supabaseAdmin();

    // Anfrage via booking_token -> therapist_id
    const { data: anfrage, error: aErr } = await sb
      .from("anfragen")
      .select("id, assigned_therapist_id, status")
      .eq("booking_token", bookingToken)
      .single();

    if (aErr || !anfrage) return json({ error: "INVALID_TOKEN" }, 404);

    const therapistId = anfrage.assigned_therapist_id;
    if (!therapistId) return json({ error: "NO_THERAPIST_ASSIGNED" }, 400);

    const { settings, tokens } = await getTherapistContext(therapistId);
    if (!settings?.booking_enabled) return json({ slots: [] });

    const timeZone = settings.time_zone || "Europe/Vienna";
    const slotMin = Number(settings.slot_duration_min || 60);
    const bufferMin = Number(settings.buffer_min || 10);
    const workingHours = settings.working_hours || {};

    // Zeitraum
    const startDate = parseISO(from);
    const endDate = addDays(startDate, Math.min(Math.max(days, 1), 60));

    const timeMinISO = new Date(startDate).toISOString();
    const timeMaxISO = new Date(endDate).toISOString();

    // Google busy
    const busyBlocks = await fetchGoogleBusyBlocks(tokens, timeMinISO, timeMaxISO, timeZone);

    // Zusätzlich: vorhandene sessions blocken (falls Google mal nicht synced)
    const { data: dbSessions } = await sb
      .from("sessions")
      .select("date, duration_min")
      .eq("therapist_id", therapistId)
      .gte("date", timeMinISO)
      .lte("date", timeMaxISO);

    const dbBusy = (dbSessions || []).map((s) => {
      const start = new Date(s.date);
      const end = new Date(start.getTime() + Number(s.duration_min || 60) * 60000);
      return { start, end };
    });

    const allBusy = [...busyBlocks, ...dbBusy];

    // Slots pro Tag generieren
    const out = [];
    for (let i = 0; i < days; i++) {
      const day = addDays(startDate, i);
      const dayISO = format(day, "yyyy-MM-dd");

      const slots = generateDaySlots({
        dateISO: dayISO,
        workingHours,
        slotMin,
        bufferMin,
        busyBlocks: allBusy,
        timeZone,
      });

      if (slots.length) out.push({ day: dayISO, slots });
    }

    return json({ therapist_id: therapistId, slots: out });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
