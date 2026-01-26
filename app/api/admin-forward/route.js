import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { requestId, therapists, client, vorname } = await req.json();

    if (!requestId || !Array.isArray(therapists) || therapists.length === 0) {
      return new Response(
        JSON.stringify({ error: "invalid_payload" }),
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anfragen")
      .update({
        admin_therapeuten: therapists,
        status: "admin_weiterleiten",
      })
      .eq("id", requestId);

    if (error) {
      console.error("DB ERROR", error);
      return new Response(
        JSON.stringify({ error: "db_error" }),
        { status: 500 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      "https://poiseconnect.vercel.app";

 const link =
  baseUrl + "/kontakt?anfrageId=" + requestId;
    
    const therapistListHtml = therapists
      .map((name) => `<li><strong>${String(name)}</strong></li>`)
      .join("");

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Bitte wähle deine Therapeut:in",
        html: `
          <p>Hallo ${vorname || ""},</p>
          <p>Wir haben passende Therapeut:innen für dich ausgewählt.</p>
          <p><strong>Du kannst aus genau diesen auswählen:</strong></p>
          <ul>${therapistListHtml}</ul>
          <p>
            <a href="${link}" style="font-weight:bold;">
              👉 Jetzt auswählen & weitermachen
            </a>
          </p>
        `,
      }),
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("ADMIN FORWARD ERROR", err);
    return new Response(
      JSON.stringify({ error: "server_error" }),
      { status: 500 }
    );
  }
}
