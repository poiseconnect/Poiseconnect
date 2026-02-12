export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("📥 BODY:", body);

    const { requestId, therapist_id, proposals } = body;

    if (!requestId || !therapist_id || !Array.isArray(proposals)) {
      return json({ error: "missing_data" }, 400);
    }

    // ------------------------------------------------
    // Vorschläge vorbereiten
    // ------------------------------------------------
    const rows = proposals
      .filter((p) => p.date)
      .map((p) => ({
        anfrage_id: requestId,
        therapist_id,
        date: p.date,
      }));

    if (!rows.length) {
      return json({ error: "no_valid_dates" }, 400);
    }

    console.log("📤 INSERT:", rows);

    const { error: insertError } = await supabase
      .from("appointment_proposals")
      .insert(rows);

    if (insertError) {
      console.error("❌ INSERT ERROR:", insertError);
      return json({ error: insertError.message }, 500);
    }

    // ------------------------------------------------
    // 🔥 EMAIL HOLEN
    // ------------------------------------------------
    const { data: request, error: reqError } = await supabase
      .from("anfragen")
      .select("email, vorname")
      .eq("id", requestId)
      .single();

    if (reqError || !request?.email) {
      console.error("❌ EMAIL LOAD ERROR:", reqError);
      return json({ error: "client_email_missing" }, 500);
    }

    // ------------------------------------------------
    // 🔥 LINK BAUEN
    // ------------------------------------------------
    const link = `https://poiseconnect.vercel.app/confirm-proposal?request=${requestId}`;

    // ------------------------------------------------
    // 🔥 MAIL SENDEN (Resend)
    // ------------------------------------------------
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "POISE <termine@mypoise.de>",
        to: request.email,
        subject: "Deine Terminvorschläge 🤍",
        html: `
          <p>Hallo ${request.vorname || ""},</p>
          <p>deine Therapeutin hat dir Termine vorgeschlagen.</p>
          <p><a href="${link}">👉 Termin auswählen</a></p>
          <p>Liebe Grüße<br/>POISE</p>
        `,
      }),
    });

    console.log("✅ MAIL SENT TO:", request.email);

    return json({ ok: true });
  } catch (e) {
    console.error("SERVER ERROR:", e);
    return json({ error: "server_error" }, 500);
  }
}
