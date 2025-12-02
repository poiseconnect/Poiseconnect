export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ SUPABASE ENV FEHLT (forward-request):", {
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
    const { requestId, client, vorname } = body;

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

    await supabase
      .from("anfragen")
      .update({
        wunschtherapeut: null,
        bevorzugte_zeit: null,
        status: "team_neu",
      })
      .eq("id", requestId);

    if (process.env.RESEND_API_KEY) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://poiseconnect.vercel.app";

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
            <p>Hallo ${vorname || ""},</p>
            <p>deine Anfrage wird an ein anderes Teammitglied weitergeleitet.</p>
            <p>
              Du kannst hier ein neues Teammitglied auswählen:
              <a href="${baseUrl}?resume=5&email=${encodeURIComponent(
                client
              )}">
                Zur Auswahl
              </a>
            </p>
          `,
        }),
      }).catch((e) => console.error("Resend error (forward-request):", e));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ SERVER ERROR (forward-request):", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
