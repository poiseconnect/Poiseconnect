import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { requestId, therapists, client, vorname } = body;
    
const cleanTherapists = Array.isArray(therapists)
  ? therapists.filter(Boolean).slice(0, 3)
  : [];

if (!requestId || cleanTherapists.length === 0) {
  return new Response("invalid_payload", { status: 400 });
}
    if (!requestId || !Array.isArray(therapists) || therapists.length === 0) {
      return new Response("invalid_payload", { status: 400 });
    }

    // 1) Speichern (E-Mails) + Status setzen/halten
    const { error: updateError } = await supabase
      .from("anfragen")
.update({
  admin_therapeuten: therapists, // ✅ Array von NAMEN
  status: "admin_weiterleiten",
})
      .eq("id", requestId);

    if (updateError) {
      console.error(updateError);
      return new Response("db_error", { status: 500 });
    }

    // 2) Mail
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://poiseconnect.vercel.app";

    // Link so, dass dein Formular später rid auslesen kann:
const link = `${baseUrl}/?resume=admin&anfrageId=${requestId}`;
    
    const therapistListHtml = cleanTherapists
  .map((e) => `<li>${e}</li>`)
  .join("");

    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Bitte wähle deine Therapeut:in für den nächsten Schritt",
        html: `
          <p>Hallo ${vorname || ""},</p>
          <p>wir haben passende Therapeut:innen für dich ausgewählt.</p>

          <p><strong>Du kannst aus genau diesen auswählen:</strong></p>
     import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { requestId, therapists, client, vorname } = body;

    // ================= VALIDATION =================
    if (
      !requestId ||
      !Array.isArray(therapists) ||
      therapists.length === 0
    ) {
      return new Response(
        JSON.stringify({ error: "invalid_payload" }),
        { status: 400 }
      );
    }

    // ================= DB UPDATE =================
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        admin_therapeuten: therapists, // ✅ Array von NAMEN
        status: "admin_weiterleiten",
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("DB UPDATE ERROR:", updateError);
      return new Response(
        JSON.stringify({ error: "db_error" }),
        { status: 500 }
      );
    }

    // ================= MAIL PREP =================
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://poiseconnect.vercel.app";

    // 🔗 Formular-Link (rid wird später im Formular ausgewertet)
    const link = `${baseUrl}/kontakt?resume=admin&rid=${requestId}`;

    // ✅ HTML-Liste der Therapeut:innen (NAMEN!)
    const therapistListHtml = therapists
      .map((name) => `<li><strong>${String(name)}</strong></li>`)
      .join("");

    // ================= SEND MAIL =================
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Bitte wähle deine Therapeut:in für den nächsten Schritt",
        html: `
          <p>Hallo ${vorname || ""},</p>

          <p>
            wir haben passende Therapeut:innen für dich ausgewählt.
          </p>

          <p><strong>Du kannst aus genau diesen auswählen:</strong></p>

          <ul>
            ${therapistListHtml}
          </ul>

          <p>
            <a href="${link}" style="font-weight:bold;">
              👉 Jetzt auswählen & weitermachen
            </a>
          </p>
        `,
      }),
    });

    if (!mailRes.ok) {
      const text = await mailRes.text();
      console.warn("MAIL FAILED:", text);
      // ❗ Status & Auswahl bleiben trotzdem gespeichert
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200 }
    );
  } catch (err) {
    console.error("ADMIN-FORWARD ERROR:", err);
    return new Response(
      JSON.stringify({ error: "server_error" }),
      { status: 500 }
    );
  }
}
          <p>
            <a href="${link}" style="font-weight:bold;">
              👉 Jetzt auswählen & weitermachen
            </a>
          </p>
        `,
      }),
    });

    if (!mailRes.ok) {
      const t = await mailRes.text();
      console.warn("mail failed:", t);
      // Status + Auswahl bleiben trotzdem gespeichert
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("server_error", { status: 500 });
  }
}
