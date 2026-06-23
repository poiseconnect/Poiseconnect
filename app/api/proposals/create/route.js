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
function viennaLocalToUtc(value) {
  if (!value) return null;

  const raw = String(value).replace(" ", "T");
  const [datePart, timePartRaw] = raw.split("T");
  const timePart = (timePartRaw || "").slice(0, 5);

  if (!datePart || !timePart) return null;

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const localAsUTC = Date.UTC(year, month - 1, day, hour, minute, 0);

  function getViennaOffsetMs(utcMs) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Vienna",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(utcMs));

    const obj = {};
    for (const p of parts) obj[p.type] = p.value;

    return (
      Date.UTC(
        Number(obj.year),
        Number(obj.month) - 1,
        Number(obj.day),
        Number(obj.hour),
        Number(obj.minute),
        Number(obj.second)
      ) - utcMs
    );
  }

  let utcMs = localAsUTC - getViennaOffsetMs(localAsUTC);
  utcMs = localAsUTC - getViennaOffsetMs(utcMs);

  return new Date(utcMs).toISOString();
}
export async function POST(req) {
  try {
    const body = await req.json();
    console.log("📥 BODY:", body);

    const { requestId, therapist_id, proposals } = body;

    if (!requestId || !therapist_id || !Array.isArray(proposals)) {
      return json({ error: "missing_data" }, 400);
    }

    // ------------------------------------------------
    // Vorschläge vorbereiten
    // ------------------------------------------------
const expiresAt = new Date(
  Date.now() + 4 * 24 * 60 * 60 * 1000
).toISOString();


const rows = proposals
  .filter((p) => p.date)
  .map((p) => ({
    anfrage_id: requestId,
    therapist_id,
    date: viennaLocalToUtc(p.date),
    expires_at: expiresAt,
  }))
  .filter((row) => row.date);


    if (!rows.length) {
      return json({ error: "no_valid_dates" }, 400);
    }

// Alte Vorschläge dieser Anfrage löschen,
// damit beim zweiten Senden nur die neuen gelten
const { error: deleteOldError } = await supabase
  .from("appointment_proposals")
  .delete()
  .eq("anfrage_id", requestId);

if (deleteOldError) {
  console.error("❌ DELETE OLD PROPOSALS ERROR:", deleteOldError);
  return json({ error: deleteOldError.message }, 500);
}

console.log("📤 INSERT:", rows);

const { error: insertError } = await supabase
  .from("appointment_proposals")
  .insert(rows);

    if (insertError) {
      console.error("❌ INSERT ERROR:", insertError);
      return json({ error: insertError.message }, 500);
    }

    // ------------------------------------------------
    // KLIENT:IN + COACH LADEN
    // ------------------------------------------------
    const { data: request, error: reqError } = await supabase
      .from("anfragen")
      .select("email, vorname, wunschtherapeut")
      .eq("id", requestId)
      .single();

    if (reqError || !request?.email) {
      console.error("❌ EMAIL LOAD ERROR:", reqError);
      return json({ error: "client_email_missing" }, 500);
    }

    // ------------------------------------------------
    // LINK BAUEN
    // ------------------------------------------------
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://app.mypoise.de";

    const link = `${baseUrl}/confirm-proposal?request=${requestId}`;

    const coachName = request.wunschtherapeut || "dein Coach";

    // ------------------------------------------------
    // MAIL SENDEN
    // ------------------------------------------------
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: request.email,
        subject: "Deine Terminvorschläge 🤍",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
            <h2 style="margin-bottom: 16px;">Deine Terminvorschläge 🤍</h2>

            <p>Hallo ${request.vorname || "du"},</p>

            <p>
              ich habe dir passende Terminvorschläge für unser Erstgespräch vorbereitet.
            </p>

            <p>
              Such dir gerne den Termin aus, der für dich am besten passt.
            </p>

            <p>
  Die Terminvorschläge sind für die nächsten 4 Tage gültig.
</p>

            <p style="margin: 24px 0;">
              <a
                href="${link}"
                style="
                  background:#111;
                  color:#fff;
                  padding:12px 18px;
                  border-radius:999px;
                  text-decoration:none;
                  display:inline-block;
                  font-weight:600;
                "
              >
                Terminvorschläge ansehen
              </a>
            </p>

            <p>
              Sobald du einen Termin ausgewählt hast, erhältst du anschließend noch eine separate Bestätigungsmail mit dem Link zum Erstgespräch.
            </p>

            <p>
              Falls du zu den vorgeschlagenen Zeiten keine Zeit hast oder sonst etwas nicht passt, melde dich bitte einfach unter
              <a href="mailto:hallo@mypoise.de">hallo@mypoise.de</a>.
            </p>

            <p style="margin-top: 24px;">
              Alles Liebe<br />
              ${coachName} 🤍
            </p>
          </div>
        `,
      }),
    });

if (!mailRes.ok) {
  const mailText = await mailRes.text();
  console.error("❌ MAIL ERROR:", mailText);

  return json({
    ok: true,
    warning: "proposal_saved_but_mail_failed",
    detail: mailText,
  });
}

    console.log("✅ MAIL SENT TO:", request.email);
    
await supabase
  .from("anfragen")
  .update({
    proposals_sent_at: new Date().toISOString(),
    proposals_count: rows.length,
  })
  .eq("id", requestId);
    return json({ ok: true });
  } catch (e) {
    console.error("SERVER ERROR:", e);
    return json({ error: "server_error", detail: String(e) }, 500);
  }
}
