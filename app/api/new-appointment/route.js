export const dynamic = "force-dynamic";

import { supabase } from "../../lib/supabase";

export async function POST(req) {
  try {
    const body = await req.json();

    console.log("NEW APPOINTMENT BODY:", body);

    const {
      requestId,
      client,
      therapistName,
      vorname
    } = body;

    if (!requestId || !client || !therapistName) {
      return new Response(
        JSON.stringify({ error: "missing_fields" }),
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://poiseconnect.vercel.app";

    // 1️⃣ Anfrage zurücksetzen
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        bevorzugte_zeit: null,
        status: "termin_neu",
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("NEW APPOINTMENT UPDATE ERROR:", updateError);
      return new Response(
        JSON.stringify({ error: "update_failed", detail: updateError }),
        { status: 500 }
      );
    }

    // 2️⃣ Mail an Klient:in
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

          <p>${therapistName} bittet dich, einen <strong>neuen Termin</strong> auszuwählen.</p>

          <p>
            <a href="${baseUrl}?resume=10&email=${encodeURIComponent(
              client
            )}&therapist=${encodeURIComponent(therapistName)}"
               style="color:#6f4f49; font-weight:bold;">
              Hier neuen Termin auswählen
            </a>
          </p>

          <p>Liebe Grüße<br>dein Poise-Team 🤍</p>
        `,
      }),
    });

    if (!mailRes.ok) {
      console.warn("NEW APPOINTMENT MAIL FAILED – DB UPDATE OK");
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200 }
    );

  } catch (err) {
    console.error("NEW APPOINTMENT SERVER ERROR:", err);
    return new Response(
      JSON.stringify({ error: "server_error", detail: String(err) }),
      { status: 500 }
    );
  }
}
