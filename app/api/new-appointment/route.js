export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("📥 NEW APPOINTMENT BODY:", body);

    const {
      requestId,
      client,
      therapistName,
      vorname,
    } = body || {};

    if (!requestId || !client || !therapistName) {
      return new Response(
        JSON.stringify({ error: "missing_fields" }),
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://poiseconnect.vercel.app";

    // ✅ 1️⃣ NUR Status ändern – KEINE Daten löschen
    const { error } = await supabase
      .from("anfragen")
      .update({
        status: "termin_neu",
      })
      .eq("id", requestId);

    if (error) {
      console.error("❌ NEW APPOINTMENT UPDATE ERROR:", error);
      return new Response(
        JSON.stringify({ error: "update_failed" }),
        { status: 500 }
      );
    }

    // ✅ 2️⃣ Mail mit RESUME-LINK
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Bitte neuen Termin auswählen 🤍",
        html: `
          <p>Hallo ${vorname || ""},</p>

          <p>Bitte wähle einen neuen Termin für dein Erstgespräch.</p>

          <p>
            <a href="${baseUrl}?resume=termine&anfrageId=${requestId}"
               style="color:#6f4f49; font-weight:bold;">
              Neuen Termin auswählen
            </a>
          </p>

          <p>🤍 Dein Poise-Team</p>
        `,
      }),
    });

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200 }
    );
  } catch (err) {
    console.error("🔥 NEW APPOINTMENT SERVER ERROR:", err);
    return new Response(
      JSON.stringify({ error: "server_error", detail: String(err) }),
      { status: 500 }
    );
  }
}
