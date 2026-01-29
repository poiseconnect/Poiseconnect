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
    console.log("📥 NEW APPOINTMENT BODY:", body);

    const {
      requestId,
      client,
      therapistName,
      vorname,
      oldSlot, // ⬅️ WICHTIG
    } = body || {};

if (!requestId || !client) {
  return json({ error: "missing_fields" }, 400);
}

if (!therapistName) {
  return json(
    {
      error: "missing_therapist",
      hint: "therapistName fehlt im Request-Body",
    },
    400
  );
}

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://poiseconnect.vercel.app";

    /* ===============================
       1️⃣ Alten Termin blockieren
       =============================== */

    const start = new Date(oldSlot);
    if (isNaN(start.getTime())) {
      return json({ error: "invalid_oldSlot" }, 400);
    }

    const end = new Date(start.getTime() + 60 * 60 * 1000); // ✅ 60 Minuten

    const { error: blockError } = await supabase
      .from("blocked_slots")
      .insert({
        anfrage_id: requestId,
        therapist_name: therapistName,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        reason: "client_reschedule",
      });

    if (blockError) {
      console.error("❌ BLOCK SLOT ERROR:", blockError);
      return json(
        { error: "block_failed", detail: blockError.message },
        500
      );
    }
const { error: updateError } = await supabase
  .from("anfragen")
  .update({
    status: "termin_neu",
    bevorzugte_zeit: null,
  })
  .eq("id", requestId);
    /* ===============================
       2️⃣ Anfrage zurücksetzen
       =============================== */

const { data: requestData } = await supabase
  .from("anfragen")
  .select("bevorzugte_zeit")
  .eq("id", requestId)
  .single();

if (requestData?.bevorzugte_zeit) {
  await supabase.from("blocked_slots").insert({
    anfrage_id: requestId,
    therapist_name: therapistName,
    start_at: new Date(requestData.bevorzugte_zeit).toISOString(),
    end_at: new Date(
      new Date(requestData.bevorzugte_zeit).getTime() + 60 * 60 * 1000
    ).toISOString(),
    reason: "previous_selection",
  });
}
    if (updateError) {
      console.error("❌ UPDATE REQUEST ERROR:", updateError);
      return json(
        { error: "update_failed", detail: updateError.message },
        500
      );
    }

    /* ===============================
       3️⃣ Mail mit neuem Auswahl-Link
       =============================== */

    const mailRes = await fetch("https://api.resend.com/emails", {
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

          <p>
            der ursprünglich gewählte Termin ist leider nicht verfügbar.
            Bitte wähle einen <strong>neuen Termin</strong>.
          </p>

          <p>
            <a href="${baseUrl}?resume=10&anfrageId=${requestId}&therapist=${encodeURIComponent(
              therapistName
            )}"
               style="color:#6f4f49; font-weight:bold;">
              👉 Neuen Termin auswählen
            </a>
          </p>

          <p>🤍 Dein Poise-Team</p>
        `,
      }),
    });

    if (!mailRes.ok) {
      console.warn("⚠️ MAIL FAILED – DB OK");
    }

    return json({ ok: true });
  } catch (err) {
    console.error("🔥 NEW APPOINTMENT SERVER ERROR:", err);
    return json(
      { error: "server_error", detail: String(err) },
      500
    );
  }
}
