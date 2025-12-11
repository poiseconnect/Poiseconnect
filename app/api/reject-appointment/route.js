export const dynamic = "force-dynamic";

import { supabase } from "../../lib/supabase";

export async function POST(req) {
  try {
    const body = await req.json();

    console.log("REJECT BODY:", body);

    const {
      requestId,
      client,
      vorname,
      therapist
    } = body;

    if (!requestId || !client) {
      return new Response(
        JSON.stringify({ error: "missing_fields" }),
        { status: 400 }
      );
    }

    // 1️⃣ Anfrage updaten
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        status: "abgelehnt",
        bevorzugte_zeit: null,
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("REJECT UPDATE ERROR:", updateError);
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
        subject: "Termin wurde abgesagt 🤍",
        html: `
          <p>Hallo ${vorname || ""},</p>

          <p>Leider musste ${therapist || "die Begleitung"} deinen Termin absagen.</p>

          <p>Du kannst jederzeit eine neue Anfrage stellen.</p>

          <p>Liebe Grüße<br>dein Poise-Team 🤍</p>
        `,
      }),
    });

    if (!mailRes.ok) {
      console.warn("REJECT MAIL FAILED – DB UPDATE OK");
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200 }
    );

  } catch (err) {
    console.error("REJECT SERVER ERROR:", err);
    return new Response(
      JSON.stringify({ error: "server_error", detail: String(err) }),
      { status: 500 }
    );
  }
}
