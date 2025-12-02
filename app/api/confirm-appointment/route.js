export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

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

    // 1) Anfrage als bestätigt markieren
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        status: "bestätigt",
      })
      .eq("id", requestId);

    if (updateError) {
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

    // 3) Email an Klient
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Termin bestätigt",
        html: `
          <p>Hallo,</p>
          <p>dein Termin wurde bestätigt.</p>
          <p><strong>${slot}</strong></p>
          <p>Wir freuen uns auf dich!</p>
        `,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
