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

    // 1️⃣ Anfrage korrekt weiterleiten
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        status: "admin_weiterleiten",
        wunschtherapeut: null,
        bevorzugte_zeit: null,
        assigned_therapist_id: null,
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
        subject: "Wähle jetzt deine passende Begleitung 🤍",
        html: `
          <p>Hallo ${vorname || ""},</p>

          <p>
            danke dir für dein Vertrauen 🤍
          </p>

          <p>
            die von dir ursprünglich ausgewählte Begleitung hat aktuell leider keine freien Kapazitäten.
          </p>

          <p>
            Damit du trotzdem gut begleitet wirst, kannst du jetzt eine andere passende Begleitung aus unserem Team auswählen.
          </p>

          <p>
            <a href="${link}"
               style="color:#8E3A4A; font-weight:600;">
              👉 Passende Begleitung auswählen
            </a>
          </p>

          <p>
            Nimm dir dafür gerne einen Moment Zeit und wähle die Person aus, die sich für dich stimmig anfühlt.
          </p>

          <p>
            Wenn du Fragen hast, melde dich jederzeit gern bei uns.
          </p>

          <br />

          <p>
            Alles Liebe<br />
            dein Poise-Team 🤍
          </p>
        `,
      }),
    });

    if (!mailRes.ok) {
      console.warn("FORWARD MAIL FAILED – DB UPDATE OK");
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
