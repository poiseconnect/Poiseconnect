export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();

    console.log("CONFIRM BODY:", body);

   const {
  requestId,
  therapist,
  client,
  vorname,
} = body || {};

if (!requestId || !therapist || !client) {
  return new Response(
    JSON.stringify({ error: "missing_fields" }),
    { status: 400 }
  );
}


    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://poiseconnect.vercel.app";

    // 1️⃣ Anfrage aktualisieren
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        bevorzugte_zeit: slot,
        status: "termin_bestaetigt",
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("CONFIRM UPDATE ERROR:", updateError);
      return new Response(
        JSON.stringify({
          error: "update_failed",
          detail: updateError.message,
        }),
        { status: 500 }
      );
    }

    // 2️⃣ Mail an Klient
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Dein Termin ist bestätigt 🤍",
        html: `
          <p>Hallo ${vorname || ""},</p>
          <p>dein Termin wurde bestätigt.</p>
          <p>
            <a href="${baseUrl}?resume=confirmed"
               style="color:#6f4f49; font-weight:bold;">
              Zur Bestätigung
            </a>
          </p>
        `,
      }),
    });

    if (!mailRes.ok) {
      console.warn("MAIL SEND FAILED – DB UPDATE OK");
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200 }
    );
  } catch (err) {
    console.error("CONFIRM SERVER ERROR:", err);
    return new Response(
      JSON.stringify({
        error: "server_error",
        detail: String(err),
      }),
      { status: 500 }
    );
  }
}
