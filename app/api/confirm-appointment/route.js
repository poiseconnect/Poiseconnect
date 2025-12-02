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
    const { requestId, therapist, client, slot, vorname } = await req.json();

    if (!requestId || !therapist || !client || !slot) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    const supabase = getSupabase();
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://poiseconnect.vercel.app";

    // Termin speichern
    await supabase
      .from("anfragen")
      .update({
        bevorzugte_zeit: slot,
        status: "bestätigt",
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
        subject: "Dein Termin ist bestätigt 🤍",
        html: `
          <p>Hallo ${vorname || ""},</p>
          <p>dein Termin wurde soeben bestätigt.</p>
          <p>
            <a href="${baseUrl}?resume=confirmed"
               style="color:#6f4f49; font-weight:bold;">
              Zur Bestätigung
            </a>
          </p>
        `,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ CONFIRM ERROR:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
