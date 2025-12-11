export const dynamic = "force-dynamic";

import { supabase } from "../../lib/supabase";

export async function POST(req) {
  try {
    const body = await req.json();

    console.log("FORWARD BODY:", body);

    const {
      requestId,
      client,
      vorname
    } = body;

    if (!requestId || !client) {
      return new Response(
        JSON.stringify({ error: "missing_fields" }),
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://poiseconnect.vercel.app";

    // 1) Anfrage zurücksetzen & weiterleiten
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        wunschtherapeut: null,
        bevorzugte_zeit: null,
        status: "weitergeleitet"
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("FORWARD UPDATE ERROR:", updateError);
      return new Response(
        JSON.stringify({ error: "update_failed", detail: updateError }),
        { status: 500 }
      );
    }

    // 2) Mail an Klient
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Wir leiten deine Anfrage weiter 🤍",
        html: `
          <p>Hallo ${vorname || ""},</p>

          <p>wir leiten deine Anfrage an eine passende Begleitung weiter.</p>

          <p>
            <a href="${baseUrl}?resume=8&email=${encodeURIComponent(client)}"
               style="color:#6f4f49; font-weight:bold;">
              Hier zur Auswahl der passenden Begleitung
            </a>
          </p>

          <p>Liebe Grüße<br>dein Poise-Team 🤍</p>
        `
      })
    });

    if (!mailRes.ok) {
      console.warn("FORWARD MAIL FAILED – DB UPDATE OK");
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200 }
    );

  } catch (err) {
    console.error("FORWARD SERVER ERROR:", err);
    return new Response(
      JSON.stringify({ error: "server_error", detail: String(err) }),
      { status: 500 }
    );
  }
}
