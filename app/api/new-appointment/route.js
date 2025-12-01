import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(req) {
  try {
    const { id, email, therapist, vorname } = await req.json();

    const supabase = getSupabase();

    // 1) Anfrage-Status setzen
    await supabase
      .from("anfragen")
      .update({ status: "neuer_termin_benoetigt" })
      .eq("id", id);

    // 2) Resume-Link generieren
    const resumeUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/?resume=10&email=${encodeURIComponent(
      email
    )}&therapist=${encodeURIComponent(therapist)}`;

    // 3) Email an Klient senden
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <no-reply@mypoise.de>",
        to: email,
        subject: "Bitte wähle einen neuen Termin 🤍",
        html: `
          <p>Hallo ${vorname},</p>
          <p>${therapist} hat dich gebeten einen neuen Termin auszuwählen.</p>
          <p><a href="${resumeUrl}">👉 Hier neuen Termin auswählen</a></p>
          <p>Liebe Grüße<br>Poise</p>
        `,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ NEW APPOINTMENT ERROR:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
