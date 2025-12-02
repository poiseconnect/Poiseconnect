export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export async function POST(req) {
  try {
    const body = await req.json();
    const { requestId, client, vorname } = body;

    if (!requestId || !client) {
      return NextResponse.json(
        { error: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    // Anfrage als abgelehnt markieren
    await supabase
      .from("anfragen")
      .update({ status: "abgelehnt" })
      .eq("id", requestId);

    // Email an Klienten
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Deine Anfrage",
        html: `
          <p>Hallo ${vorname},</p>
          <p>Leider kann diese Anfrage nicht angenommen werden.</p>
          <p>Bitte wähle bei Bedarf ein anderes Teammitglied.</p>
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
