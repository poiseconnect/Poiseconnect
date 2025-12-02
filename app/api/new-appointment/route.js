export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ SUPABASE ENV FEHLT (new-appointment):", {
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
    const { requestId, client } = body;

    if (!requestId || !client) {
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

    // 1) Anfrage aus DB holen → Name des Therapeuten auslesen
    const { data: reqRow, error: loadErr } = await supabase
      .from("anfragen")
      .select("wunschtherapeut")
      .eq("id", requestId)
      .single();

    if (loadErr || !reqRow) {
      console.error("Load error:", loadErr);
      return NextResponse.json(
        { error: "REQUEST_NOT_FOUND" },
        { status: 404 }
      );
    }

    const therapistName = reqRow.wunschtherapeut; // ← das brauchen wir

    // 2) Anfrage zurücksetzen (Zeit löschen)
    await supabase
      .from("anfragen")
      .update({
        bevorzugte_zeit: null,
        status: "termin_neu",
      })
      .eq("id", requestId);

    // 3) Email mit korrektem Namen schicken
    if (process.env.RESEND_API_KEY) {
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        "https://poiseconnect.vercel.app";

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
            <p>bitte wähle einen neuen Termin für dein Erstgespräch aus.</p>
            <p>
              <a href="${baseUrl}?resume=10&email=${encodeURIComponent(
                client
              )}&therapist=${encodeURIComponent(therapistName)}">
                Hier klicken, um einen neuen Termin auszuwählen
              </a>
            </p>
          `,
        }),
      }).catch((e) =>
        console.error("Resend error (new-appointment):", e)
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ SERVER ERROR (new-appointment):", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
