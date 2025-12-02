export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { requestId, client, vorname, therapist, slot } = await req.json();

    if (!client || !therapist || !slot) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://poiseconnect.vercel.app";

    // 📩 Email senden
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Dein Termin wurde bestätigt 🤍",
        html: `
          <p>Hallo ${vorname || ""},</p>

          <p>dein Erstgespräch wurde von <strong>${therapist}</strong> bestätigt 🎉</p>

          <p>
            Datum & Zeit:<br>
            <strong>${slot}</strong>
          </p>

          <p>
            <a href="${baseUrl}?resume=confirmed&email=${encodeURIComponent(
          client
        )}&therapist=${encodeURIComponent(therapist)}"
               style="color:#6f4f49; font-weight:bold;">
              Termin wurde bestätigt anzeigen
            </a>
          </p>

          <p>Wir freuen uns auf dich 🤍<br>Dein Poise-Team</p>
        `,
      }),
    });

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("❌ CONFIRM ERROR:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
