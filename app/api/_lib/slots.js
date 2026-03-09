import { google } from "googleapis";
import { oauthClient, supabaseAdmin } from "./server";
import { addMinutes, format, startOfDay, endOfDay, parseISO } from "date-fns";

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToDate(baseDate, minutes, timeZone) {
  // Wir arbeiten mit ISO im Server; timezone wird bei Google mitgegeben.
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export async function getTherapistContext(therapistId) {
  const sb = supabaseAdmin();

  const { data: settings } = await sb
    .from("therapist_booking_settings")
    .select("*")
    .eq("therapist_id", therapistId)
    .single();

  const { data: tokens } = await sb
    .from("therapist_google_tokens")
    .select("*")
    .eq("therapist_id", therapistId)
    .single();

  return { settings: settings || null, tokens: tokens || null };
}

export async function fetchGoogleBusyBlocks(tokens, timeMinISO, timeMaxISO, timeZone) {
  if (!tokens?.refresh_token && !tokens?.access_token) return [];

  const oauth = oauthClient();
  oauth.setCredentials({
    access_token: tokens.access_token || undefined,
    refresh_token: tokens.refresh_token || undefined,
    expiry_date: tokens.expiry_date || undefined,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth });

  const fb = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      timeZone,
      items: [{ id: tokens.calendar_id || "primary" }],
    },
  });

  const busy = fb?.data?.calendars?.[tokens.calendar_id || "primary"]?.busy || [];
  return busy.map((b) => ({
    start: new Date(b.start),
    end: new Date(b.end),
  }));
}

export function generateDaySlots({
  dateISO,
  workingHours,
  slotMin,
  bufferMin,
  busyBlocks,
  timeZone,
}) {
  const d = parseISO(dateISO);
  const dayKey = String(d.getDay()); // 0..6

  const wh = workingHours?.[dayKey];
  if (!wh?.start || !wh?.end) return [];

  const startM = timeToMinutes(wh.start);
  const endM = timeToMinutes(wh.end);

  const step = slotMin + bufferMin;
  const slots = [];

  for (let m = startM; m + step <= endM; m += step) {
    const slotStart = minutesToDate(d, m, timeZone);
    const slotEnd = addMinutes(slotStart, slotMin);
    const blockEnd = addMinutes(slotStart, step);

    const conflict = (busyBlocks || []).some((b) =>
      overlaps(slotStart, blockEnd, b.start, b.end)
    );

    if (!conflict) {
      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
      });
    }
  }

  return slots;
}
