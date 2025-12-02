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
    const { requestId, client, vorname, therapist } = await req.json();

    if (!requestId || !client) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Anfrage updaten
    await supabase
      .from("anfragen")
      .update({
        status: "abgelehnt",
        bevorzugte_zeit: null,
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
        subject: "Termin wurde abgesagt 🤍",
        html: `
          <p>Hallo ${vorname || ""},</p>
          <p>Leider musste ${therapist} deinen Termin absagen.</p>
          <p>Du kannst jederzeit eine neue Anfrage stellen.</p>
        `,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ REJECT ERROR:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
