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
    const { requestId, client, therapist, vorname } = await req.json();

    if (!requestId || !client || !therapist) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    const supabase = getSupabase();
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://poiseconnect.vercel.app";

    // Termin resetten
    await supabase
      .from("anfragen")
      .update({
        bevorzugte_zeit: null,
        status: "termin_neu",
      })
      .eq("id", requestId);

    // Email senden
    await fetch("https://api.resend.com/emails", {
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

          <p>${therapist} bittet dich, einen <strong>neuen Termin</strong> auszuwählen.</p>

          <p>
            <a href="${baseUrl}?resume=10&email=${encodeURIComponent(
        client
      )}&therapist=${encodeURIComponent(therapist)}"
               style="color:#6f4f49; font-weight:bold;">
              Hier neuen Termin auswählen
            </a>
          </p>

          <p>Liebe Grüße,<br>dein Poise-Team 🤍</p>
        `,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ NEW APPOINTMENT ERROR:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
