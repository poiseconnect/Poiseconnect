export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

// JSON Helper
function JSONResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Supabase (Service Role)
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ SUPABASE ENV FEHLT (new-appointment):", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }

  return createClient(url, key);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { requestId, client, therapistEmail, therapistName, vorname } = body;

    if (!requestId || !client || !therapistName) {
      return JSONResponse(
        { error: "MISSING_FIELDS" },
        400
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return JSONResponse(
        { error: "SUPABASE_NOT_CONFIGURED" },
        500
      );
    }

    // 🔄 Alten Termin in der Anfrage zurücksetzen + Status setzen
    await supabase
      .from("anfragen")
      .update({
        bevorzugte_zeit: null,
        status: "termin_neu",
      })
      .eq("id", requestId);

    // 📧 Email an Klient:in mit neuem Link
    const resendKey = process.env.RESEND_API_KEY;
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://poiseconnect.vercel.app";

    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Poise <noreply@mypoise.de>",
          to: client,
          subject: "Bitte neuen Termin auswählen 🤍",
          html: `
            <p>Hallo ${vorname || ""},</p>
            <p>${therapistName} bittet dich, einen <strong>neuen Termin</strong> auszuwählen.</p>
            <p>
              <a href="${baseUrl}?resume=10&email=${encodeURIComponent(
                client
              )}&therapist=${encodeURIComponent(therapistName)}"
                 style="color:#6f4f49; font-weight:bold;">
                Hier neuen Termin auswählen
              </a>
            </p>
            <p>Liebe Grüße,<br/>dein Poise-Team 🤍</p>
          `,
        }),
      }).catch((e) =>
        console.error("Resend error (new-appointment):", e)
      );
    }

    return JSONResponse({ ok: true });
  } catch (err) {
    console.error("❌ SERVER ERROR (new-appointment):", err);
    return JSONResponse(
      { error: "SERVER_ERROR", detail: String(err) },
      500
    );
  }
}
