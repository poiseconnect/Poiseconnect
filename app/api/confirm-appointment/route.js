export const dynamic = "force-dynamic";

import { supabase } from "../../lib/supabase";

export async function POST(req) {
  try {
    const body = await req.json();

    console.log("CONFIRM BODY:", body);

    const {
      requestId,
      therapist,
      client,
      slot,
      vorname
    } = body;

    if (!requestId || !therapist || !client || !slot) {
      return new Response(
        JSON.stringify({ error: "missing_fields" }),
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://poiseconnect.vercel.app";

    // 1) Anfrage aktualisieren
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        bevorzugte_zeit: slot,
        status: "termin_bestaetigt"
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("CONFIRM UPDATE ERROR:", updateError);
      return new Response(
        JSON.stringify({ error: "update_failed", detail: updateError }),
        { status: 500 }
      );
    }

    // 2) Mail an Klient senden
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
      console.warn("MAIL SEND FAILED, but DB update succeeded");
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200 }
    );

  } catch (err) {
    console.error("CONFIRM SERVER ERROR:", err);
    return new Response(
      JSON.stringify({ error: "server_error", detail: String(err) }),
      { status: 500 }
    );
  }
}
