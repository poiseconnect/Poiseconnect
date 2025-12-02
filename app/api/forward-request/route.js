export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(req) {
  try {
    const { requestId, client, vorname } = await req.json();

    if (!requestId || !client) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    const supabase = getSupabase();
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://poiseconnect.vercel.app";

    // Wunschtherapeut wird bewusst gelöscht → Formular startet bei Step 8 (Therapeut auswählen)
    await supabase
      .from("anfragen")
      .update({
        wunschtherapeut: null,
        bevorzugte_zeit: null,
        status: "weitergeleitet"
      })
      .eq("id", requestId);

    await fetch("https://api.resend.com/emails", {
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

          <p>Wir leiten deine Anfrage an eine passende Begleitung weiter.</p>

          <p>
            <a href="${baseUrl}?resume=8&email=${encodeURIComponent(client)}"
               style="color:#6f4f49; font-weight:bold;">
              Hier zur Auswahl der passenden Begleitung
            </a>
          </p>

          <p>Liebe Grüße,<br>dein Poise-Team 🤍</p>
        `
      })
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
