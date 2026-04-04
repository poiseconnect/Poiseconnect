export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function safeDateString(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hoursUntil(dateLike) {
  const target = new Date(dateLike).getTime();
  const now = Date.now();
  return (target - now) / (1000 * 60 * 60);
}

function inWindow(value, min, max) {
  return value >= min && value < max;
}

async function sendMail({ to, subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Poise <noreply@mypoise.de>",
      to,
      subject,
      html,
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`mail_failed_${res.status}: ${text}`);
  }

  return text;
}

async function getVideoLink(anfrage) {
  if (anfrage.meeting_link_override?.trim()) {
    return anfrage.meeting_link_override.trim();
  }

  if (!anfrage.assigned_therapist_id) return "";

  const { data: bookingData, error } = await supabase
    .from("therapist_booking_settings")
    .select("meeting_link")
    .eq("therapist_id", anfrage.assigned_therapist_id)
    .maybeSingle();

  if (error) {
    console.warn("booking_settings_load_failed", error);
    return "";
  }

  return bookingData?.meeting_link?.trim() || "";
}

export async function GET(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return json({ error: "unauthorized" }, 401);
      }
    }

    const { data: requests, error } = await supabase
      .from("anfragen")
      .select(`
        id,
        vorname,
        email,
        bevorzugte_zeit,
        assigned_therapist_id,
        wunschtherapeut,
        meeting_link_override,
        reminder_24h_sent,
        reminder_2h_sent,
        status
      `)
      .eq("status", "termin_bestaetigt")
      .not("bevorzugte_zeit", "is", null);

    if (error) {
      console.error("REMINDER LOAD ERROR:", error);
      return json({ error: error.message }, 500);
    }

    let sent24 = 0;
    let sent2 = 0;
    const logs = [];

    for (const anfrage of requests || []) {
      try {
        if (!anfrage.email || !anfrage.bevorzugte_zeit) continue;

        const hrs = hoursUntil(anfrage.bevorzugte_zeit);

        // Vergangene Termine ignorieren
        if (hrs <= 0) continue;

        const therapistName =
          anfrage.wunschtherapeut?.trim() || "dein Coach";

        const terminText = safeDateString(anfrage.bevorzugte_zeit);
        const videoLink = await getVideoLink(anfrage);

        console.log("REMINDER CHECK", {
          id: anfrage.id,
          email: anfrage.email,
          hrs,
          reminder_24h_sent: anfrage.reminder_24h_sent,
          reminder_2h_sent: anfrage.reminder_2h_sent,
          videoLink,
        });

        // 24h Reminder
        if (
          !anfrage.reminder_24h_sent &&
          inWindow(hrs, 23.5, 24.5)
        ) {
          await sendMail({
            to: anfrage.email,
            subject: "Erinnerung an dein Erstgespräch morgen 🤍",
            html: `
              <p>Hallo ${anfrage.vorname || ""},</p>

              <p>
                wir möchten dich an dein Erstgespräch morgen erinnern.
              </p>

              <p>
                <strong>Dein Coach:</strong> ${therapistName}<br/>
                <strong>Termin:</strong> ${terminText}
              </p>

              <p>
                <strong>Hier geht es direkt zu eurem Video-Call:</strong><br/>
                ${
                  videoLink
                    ? `<a href="${videoLink}" target="_blank" style="color:#8E3A4A; font-weight:600;">
                         👉 Zum Video-Call
                       </a>`
                    : `Falls dein Video-Link fehlen sollte, melde dich bitte unter
                       <a href="mailto:hallo@mypoise.de">hallo@mypoise.de</a>.`
                }
              </p>

              <p>
                Nimm dir für das Gespräch gerne einen ruhigen Moment und einen geschützten Raum.
              </p>

              <p>
                Falls du den Termin nicht wahrnehmen kannst oder etwas dazwischenkommt,
                melde dich bitte unter
                <a href="mailto:hallo@mypoise.de">hallo@mypoise.de</a>.
              </p>

              <p>
                Alles Liebe<br/>
                ${therapistName} 🤍
              </p>
            `,
          });

          const { error: update24Error } = await supabase
            .from("anfragen")
            .update({ reminder_24h_sent: true })
            .eq("id", anfrage.id);

          if (update24Error) {
            console.error("REMINDER 24 FLAG ERROR:", update24Error);
          } else {
            sent24 += 1;
            logs.push({
              id: anfrage.id,
              type: "24h",
              email: anfrage.email,
            });
          }
        }

        // 2h Reminder
        if (
          !anfrage.reminder_2h_sent &&
          inWindow(hrs, 1.5, 2.5)
        ) {
          await sendMail({
            to: anfrage.email,
            subject: "Dein Erstgespräch startet in Kürze 🤍",
            html: `
              <p>Hallo ${anfrage.vorname || ""},</p>

              <p>
                dein Erstgespräch startet in Kürze.
              </p>

              <p>
                <strong>Dein Coach:</strong> ${therapistName}<br/>
                <strong>Termin:</strong> ${terminText}
              </p>

              <p>
                <strong>Hier ist dein Video-Call Link:</strong><br/>
                ${
                  videoLink
                    ? `<a href="${videoLink}" target="_blank" style="color:#8E3A4A; font-weight:600;">
                         👉 Jetzt zum Video-Call
                       </a>`
                    : `Falls dein Video-Link fehlen sollte, melde dich bitte unter
                       <a href="mailto:hallo@mypoise.de">hallo@mypoise.de</a>.`
                }
              </p>

              <p>
                Wir freuen uns auf dich 🤍
              </p>

              <p>
                Alles Liebe<br/>
                ${therapistName}
              </p>
            `,
          });

          const { error: update2Error } = await supabase
            .from("anfragen")
            .update({ reminder_2h_sent: true })
            .eq("id", anfrage.id);

          if (update2Error) {
            console.error("REMINDER 2H FLAG ERROR:", update2Error);
          } else {
            sent2 += 1;
            logs.push({
              id: anfrage.id,
              type: "2h",
              email: anfrage.email,
            });
          }
        }
      } catch (itemError) {
        console.error("REMINDER ITEM ERROR", anfrage?.id, itemError);
      }
    }

    return json({
      ok: true,
      sent24,
      sent2,
      checked: (requests || []).length,
      logs,
    });
  } catch (e) {
    console.error("REMINDER SERVER ERROR:", e);
    return json(
      { error: "server_error", detail: String(e) },
      500
    );
  }
}
