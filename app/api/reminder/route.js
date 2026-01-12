export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

const resend = new Resend(process.env.RESEND_API_KEY);

// Simple helper
function hoursFromNow(h) {
  return new Date(Date.now() + h * 60 * 60 * 1000);
}

export async function POST(req) {
  try {
    // Optional: protect with a secret for cron calls
    const secret = process.env.REMINDER_SECRET;
    if (secret) {
      const got = req.headers.get("x-reminder-secret");
      if (got !== secret) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
    }

    const supabase = getSupabase();

    // We send reminders for sessions that are in the future:
    // - 24h window: now .. now+24h (and not yet 24h-sent)
    // - 2h window:  now .. now+2h (and not yet 2h-sent)
    const now = new Date();
    const in24 = hoursFromNow(24);
    const in2 = hoursFromNow(2);

    // Pull upcoming sessions + client email via anfragen join.
    // Assumes sessions.date is an ISO timestamp string (or timestamptz).
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select(
        `
        id,
        date,
        therapist,
        anfrage_id,
        reminder_24_sent,
        reminder_2_sent,
        anfragen (
          email,
          vorname,
          nachname
        )
      `
      )
      .gte("date", now.toISOString())
      .lte("date", in24.toISOString());

    if (error) {
      console.error("reminder query error", error);
      return NextResponse.json({ error: "QUERY_FAILED" }, { status: 500 });
    }

    const sent = [];

    for (const s of sessions || []) {
      const when = new Date(s.date);
      const minutes = (when.getTime() - now.getTime()) / 60000;
      const clientEmail = s.anfragen?.email;
      if (!clientEmail) continue;

      // Decide which reminder to send:
      const should2 = minutes <= 120 && !s.reminder_2_sent;
      const should24 = minutes > 120 && minutes <= 24 * 60 && !s.reminder_24_sent;

      if (!should2 && !should24) continue;

      const subject = should2
        ? "Erinnerung: Deine Poise-Sitzung in 2 Stunden"
        : "Erinnerung: Deine Poise-Sitzung morgen";

      const pretty = when.toLocaleString("de-AT", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const html = `
        <div style="font-family: Arial, sans-serif; line-height:1.5">
          <p>Hallo ${s.anfragen?.vorname || ""},</p>
          <p>das ist eine Erinnerung an deine bevorstehende Sitzung:</p>
          <p><strong>${pretty}</strong></p>
          <p>Wenn du den Termin nicht einhalten kannst, antworte bitte auf diese E-Mail, damit Poise bzw. dein Teammitglied mit dir umplanen kann.</p>
          <p>Liebe Grüße<br/>Poise</p>
        </div>
      `;

      await resend.emails.send({
        from: "Poise <noreply@mypoise.de>",
        to: clientEmail,
        subject,
        html,
      });

      // Mark as sent
      const patch = {};
      if (should2) patch.reminder_2_sent = true;
      if (should24) patch.reminder_24_sent = true;

      await supabase.from("sessions").update(patch).eq("id", s.id);

      sent.push({ id: s.id, type: should2 ? "2h" : "24h", to: clientEmail });
    }

    return NextResponse.json({ ok: true, sent }, { status: 200 });
  } catch (err) {
    console.error("reminder server error", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
