export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { teamData } from "../../teamData";   // ← FIXED IMPORT

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

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://poiseconnect.vercel.app";

    // Anfrage zurücksetzen
    const supabase = getSupabase();
    await supabase
      .from("anfragen")
      .update({
        wunschtherapeut: null,
        bevorzugte_zeit: null,
        status: "weitergeleitet",
      })
      .eq("id", requestId);

    // Email an Klient
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Wähle bitte eine neue Psychologin 🤍",
        html: `
          <p>Hallo ${vorname || ""},</p>
          <p>Deine Anfrage wurde weitergeleitet.</p>
          <p>Bitte wähle erneut eine Psychologin aus:</p>
          <p>
            <a href="${baseUrl}?resume=8&email=${encodeURIComponent(
        client
      )}"
               style="color:#6f4f49; font-weight:bold;">
              Neue Psychologin auswählen
            </a>
          </p>
        `,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ FORWARD REQUEST ERROR:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
