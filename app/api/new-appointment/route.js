export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export async function POST(req) {
  try {
    const body = await req.json();
    const { requestId, client, therapist } = body;

    if (!requestId || !client || !therapist) {
      return NextResponse.json(
        { error: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    // Anfrage zurücksetzen
    await supabase
      .from("anfragen")
      .update({
        bevorzugte_zeit: null,
        status: "termin_neu",
      })
      .eq("id", requestId);

    // Email an Klient → resume=10
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Bitte neuen Termin auswählen",
        html: `
          <p>Hallo,</p>
          <p>Bitte wähle einen neuen Termin aus.</p>
          <p>
            <a href="https://poiseconnect.vercel.app?resume=10&email=${client}&therapist=${therapist}">
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
