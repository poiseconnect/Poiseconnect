export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();

    console.log("FORWARD BODY:", body);

    const { requestId, client, vorname, excludedTherapist } = body || {};

    if (!requestId || !client) {
      return new Response(
        JSON.stringify({ error: "missing_fields" }),
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://app.mypoise.de";

    const link = `${baseUrl}?resume=8&rid=${requestId}`;

    // 1️⃣ Anfrage so zurücksetzen, dass Klient:in selbst neu wählen kann
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        status: "admin_weiterleiten",
        wunschtherapeut: null,
        bevorzugte_zeit: null,
        assigned_therapist_id: null,
        admin_therapeuten: [],
        excluded_therapeuten: excludedTherapist
          ? [excludedTherapist]
          : [],
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("FORWARD UPDATE ERROR:", updateError);
      return new Response(
        JSON.stringify({
          error: "update_failed",
          detail: updateError.message,
        }),
        { status: 500 }
      );
    }

    // 2️⃣ Mail an Klient:in
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Bitte wähle eine neue Begleitung 🤍",
        html: `
          <p>Hallo ${vorname || ""},</p>

          <p>
            deine ursprünglich ausgewählte Begleitung hat aktuell leider keine Kapazitäten.
          </p>

          <p>
            Deshalb kannst du jetzt eine neue passende Begleitung aus unserem Team auswählen.
          </p>

          <p>
            <a href="${link}" style="color:#6f4f49; font-weight:bold;">
              👉 Neue Begleitung auswählen
            </a>
          </p>

          <p>
            Danach kannst du deinen Prozess direkt fortsetzen.
          </p>

          <p>
            Wenn du Fragen hast, melde dich jederzeit gerne bei uns unter
            <a href="mailto:hallo@mypoise.de">hallo@mypoise.de</a>.
          </p>

          <p>
            Herzliche Grüße<br />
            dein Poise-Team 🤍
          </p>
        `,
      }),
    });

    if (!mailRes.ok) {
      const mailText = await mailRes.text();
      console.warn("FORWARD MAIL FAILED – DB UPDATE OK:", mailText);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200 }
    );
  } catch (err) {
    console.error("FORWARD SERVER ERROR:", err);
    return new Response(
      JSON.stringify({
        error: "server_error",
        detail: String(err),
      }),
      { status: 500 }
    );
  }
}
