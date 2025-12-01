import { NextResponse } from "next/server";
import { Resend } from "resend";

// 📩 Resend initialisieren
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const body = await req.json();

    const { id, email, vorname } = body;

    if (!email) {
      return NextResponse.json(
        { error: "MISSING_EMAIL" },
        { status: 400 }
      );
    }

    // ----------------------------------------
    // 📩 EMAIL AN KLIENT SENDEN
    // ----------------------------------------
    const link = `https://mypoise.de/form?resume=5&email=${encodeURIComponent(email)}`;

    await resend.emails.send({
      from: "Poise <noreply@mypoise.de>",
      to: email,
      subject: "Bitte wähle ein anderes Teammitglied 🤍",
      html: `
        <p>Hallo ${vorname},</p>
        <p>vielen Dank für deine Anfrage.</p>
        <p>Für dein Anliegen wäre eventuell ein anderes Teammitglied besser geeignet.</p>

        <p>Bitte wähle hier erneut eine passende Person aus:</p>

        <p><a href="${link}" style="font-size:18px;">🧡 Teammitglied auswählen</a></p>

        <br/>
        <p>Liebe Grüße<br/>Poise Team</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ REASSIGN ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
