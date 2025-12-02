export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service-Role-Key

  if (!url || !key) {
    console.error("❌ SUPABASE ENV FEHLT (confirm-appointment):", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }

  return createClient(url, key);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { requestId, therapist, client, slot } = body;

    if (!requestId || !therapist || !client || !slot) {
      return NextResponse.json(
        { error: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "SUPABASE_NOT_CONFIGURED" },
        { status: 500 }
      );
    }

    // 1) Anfrage als "bestätigt" markieren
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({ status: "bestätigt" })
      .eq("id", requestId);

    if (updateError) {
      console.error("DB UPDATE ERROR (confirm):", updateError);
      return NextResponse.json(
        { error: "UPDATE_FAILED", detail: updateError.message },
        { status: 500 }
      );
    }

    // 2) Termin blockieren
    await supabase.from("confirmed_appointments").insert({
      therapist,
      termin_iso: slot,
      client_email: client,
    });

    // 3) Email an Klient (Resend)
    if (process.env.RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Poise <noreply@mypoise.de>",
          to: client,
          subject: "Dein Termin wurde bestätigt",
          html: `
            <p>Hallo,</p>
            <p>dein Erstgespräch wurde bestätigt.</p>
            <p><strong>${slot}</strong></p>
            <p>Wir freuen uns auf dich 🤍</p>
          `,
        }),
      }).catch((e) => console.error("Resend error (confirm):", e));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ SERVER ERROR (confirm):", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
