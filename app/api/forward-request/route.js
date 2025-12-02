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

    // Anfrage freigeben
    await supabase
      .from("anfragen")
      .update({
        wunschtherapeut: null,
        bevorzugte_zeit: null,
        status: "team_neu",
      })
      .eq("id", requestId);

    // Email an Klient → resume=5
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Bitte wähle ein anderes Teammitglied",
        html: `
          <p>Hallo ${vorname},</p>
          <p>Bitte wähle ein anderes Teammitglied aus.</p>
          <p>
            <a href="https://poiseconnect.vercel.app?resume=5&email=${client}">
              Hier klicken
            </a>
          </p>
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
