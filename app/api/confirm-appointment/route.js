export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();

    console.log("✅ CONFIRM-APPOINTMENT BODY:", body);

    const { requestId, client, vorname } = body || {};

    if (!requestId || !client) {
      return new Response(
        JSON.stringify({ error: "missing_fields" }),
        { status: 400 }
      );
    }

    /* --------------------------------------------------
       1️⃣ AKTUELLE ANFRAGE LADEN (SICHERHEIT)
    -------------------------------------------------- */
    const { data: existing, error: loadError } = await supabase
      .from("anfragen")
      .select("id, status")
      .eq("id", requestId)
      .single();

    if (loadError || !existing) {
      console.error("❌ LOAD REQUEST ERROR:", loadError);
      return new Response(
        JSON.stringify({ error: "request_not_found" }),
        { status: 404 }
      );
    }

    // ❗ Schon bestätigt → nichts tun (idempotent)
    if (existing.status === "termin_bestaetigt") {
      console.log("ℹ️ already confirmed:", requestId);
      return new Response(
        JSON.stringify({ ok: true, alreadyConfirmed: true }),
        { status: 200 }
      );
    }

    /* --------------------------------------------------
       2️⃣ STATUS → termin_bestaetigt
    -------------------------------------------------- */
    const { error: updateError } = await supabase
      .from("anfragen")
      .update(
        { status: "termin_bestaetigt" },
        { returning: "minimal" }
      )
      .eq("id", requestId);

    if (updateError) {
      console.error("❌ CONFIRM UPDATE ERROR:", updateError);
      return new Response(
        JSON.stringify({
          error: "update_failed",
          detail: updateError.message,
        }),
        { status: 500 }
      );
    }

    console.log("✅ STATUS UPDATED → termin_bestaetigt:", requestId);

    /* --------------------------------------------------
       3️⃣ MAIL AN KLIENT:IN
    -------------------------------------------------- */
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://poiseconnect.vercel.app";

    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to: client,
        subject: "Dein Termin ist bestätigt 🤍",
        html: `
          <p>Hallo ${vorname || ""},</p>
          <p>dein Termin wurde bestätigt.</p>
          <p>
            <a href="${baseUrl}?resume=confirmed"
               style="color:#6f4f49; font-weight:bold;">
              Zur Bestätigung
            </a>
          </p>
        `,
      }),
    });

    if (!mailRes.ok) {
      console.warn("⚠️ MAIL FAILED – STATUS IST ABER KORREKT");
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200 }
    );
  } catch (err) {
    console.error("🔥 CONFIRM SERVER ERROR:", err);
    return new Response(
      JSON.stringify({
        error: "server_error",
        detail: String(err),
      }),
      { status: 500 }
    );
  }
}
