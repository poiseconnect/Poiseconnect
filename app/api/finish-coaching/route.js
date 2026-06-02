export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

/**
 * ⚠️ WICHTIG:
 * In app/api NIE client-supabase verwenden!
 */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔗 Feedback-Link (Microsoft Forms)
const FEEDBACK_URL =
  "https://forms.office.com/Pages/ResponsePage.aspx?id=DQSIkWdsW0yxEjajBLZtrQAAAAAAAAAAAAN__lvx3A5UMEFTNzZUQkVFQVVLRE5TTVFQVFMxWURETi4u"; 
// ⬆️ HIER deinen echten Forms-Link einsetzen

export async function POST(req) {
  try {
    // 🔹 BODY – GENAU EINMAL
    const body = await req.json();
    const { anfrageId } = body || {};

    console.log("📥 FINISH BODY:", body);

    if (!anfrageId) {
      return new Response(
        JSON.stringify({ error: "missing_anfrageId" }),
        { status: 400 }
      );
    }


    // ✅ Status auf beendet setzen + Klientendaten laden
    const { data: anfrage, error: updateError } = await supabase
      .from("anfragen")
      .update({ status: "beendet" })
      .eq("id", anfrageId)
      .select("email, vorname")
      .single();

    if (updateError) {
      console.error("❌ FINISH UPDATE ERROR:", updateError);
      return new Response(
        JSON.stringify({
          error: "UPDATE_FAILED",
          detail: updateError.message,
        }),
        { status: 500 }
      );
    }

    console.log("✅ COACHING BEENDET");

    // 📧 Feedback-Mail senden
    if (anfrage?.email) {
      const mailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Poise <noreply@mypoise.de>",
          to: anfrage.email,
          subject: "Danke für dein Vertrauen 🤍 – kurzes Feedback",
          html: `
            <p>Hallo ${anfrage.vorname || ""},</p>

            <p>
              vielen Dank für dein Vertrauen und die gemeinsame Zeit.
              Wir würden uns sehr über dein kurzes Feedback freuen.
            </p>

            <p>
              👉 <a href="${FEEDBACK_URL}"
                   style="color:#6f4f49; font-weight:bold;">
                Zum Feedbackbogen
              </a>
            </p>

            <p>Danke dir 🤍<br/>Dein Poise-Team</p>
          `,
        }),
      });

      if (!mailRes.ok) {
        console.warn("⚠️ FEEDBACK MAIL FAILED – STATUS IST TROTZDEM BEENDET");
      }
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200 }
    );

  } catch (err) {
    console.error("🔥 FINISH SERVER ERROR:", err);
    return new Response(
      JSON.stringify({
        error: "SERVER_ERROR",
        detail: String(err),
      }),
      { status: 500 }
    );
  }
}
