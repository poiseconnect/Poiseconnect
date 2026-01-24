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

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("📥 NEW APPOINTMENT BODY:", body);

    const { requestId, client, therapistName, vorname } = body || {};

    if (!requestId || !client || !therapistName) {
      return json({ error: "missing_fields" }, 400);
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://poiseconnect.vercel.app";

    // 1️⃣ Status auf „termin_neu“ setzen (SONST NICHTS)
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        status: "termin_neu",
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("❌ NEW APPOINTMENT UPDATE ERROR:", updateError);
      return json(
        { error: "update_failed", detail: updateError.message },
        500
      );
    }

    // 2️⃣ Mail mit sauberem Resume-Link → Step 10
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Bitte neuen Termin auswählen 🤍",
        html: `
          <p>Hallo ${vorname || ""},</p>

          <p>
            bitte wähle einen <strong>neuen Termin</strong> für dein Erstgespräch.
          </p>

          <p>
            <a href="${baseUrl}?resume=10&anfrageId=${requestId}&therapist=${encodeURIComponent(
              therapistName
            )}"
               style="color:#6f4f49; font-weight:bold;">
              Neuen Termin auswählen
            </a>
          </p>

          <p>🤍 Dein Poise-Team</p>
        `,
      }),
    });

    if (!mailRes.ok) {
      console.warn("⚠️ NEW APPOINTMENT MAIL FAILED – DB UPDATE OK");
    }

    return json({ ok: true });
  } catch (err) {
    console.error("🔥 NEW APPOINTMENT SERVER ERROR:", err);
    return json(
      { error: "server_error", detail: String(err) },
      500
    );
  }
}
