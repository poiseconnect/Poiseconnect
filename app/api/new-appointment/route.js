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
      therapistId,
      vorname,
      oldSlot,
    } = body || {};

    if (!requestId || !client) {
      return json({ error: "missing_fields" }, 400);
    }

    if (!therapistName || !therapistId) {
      return json(
        {
          error: "missing_therapist",
          hint: "therapistName oder therapistId fehlt im Request-Body",
        },
        400
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://poiseconnect.vercel.app";

    /* ===============================
       1️⃣ Alten Slot blockieren
    =============================== */
    if (oldSlot) {
      const start = new Date(oldSlot);

      if (!isNaN(start.getTime())) {
        const end = new Date(start.getTime() + 60 * 60 * 1000);

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
        } else {
          console.log("✅ SLOT BLOCKED:", start.toISOString());
        }
      }
    }

    /* ===============================
       2️⃣ Anfrage sauber zurücksetzen
    =============================== */
const updatePayload = {
  status: "termin_neu",
  match_state: "reschedule",
  bevorzugte_zeit: null,
  assigned_therapist_id: therapistId,
  wunschtherapeut: therapistName,
};
    const { error: updateError } = await supabase
      .from("anfragen")
      .update(updatePayload)
      .eq("id", requestId);

    if (updateError) {
      console.error("❌ UPDATE REQUEST ERROR:", updateError);
      return json(
        { error: "update_failed", detail: updateError.message },
        500
      );
    }

    console.log("✅ REQUEST UPDATED", {
      requestId,
      therapistName,
      therapistId,
    });

    const link = `${baseUrl}?resume=10&anfrageId=${requestId}&therapist=${encodeURIComponent(
      therapistName
    )}`;

    console.log("🔗 RESCHEDULE LINK:", link);

    /* ===============================
       3️⃣ Mail senden
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
            dein Termin wurde geändert – bitte wähle hier einen neuen:
          </p>

          <p>
            <a 
              href="${link}"
              target="_blank"
              style="color:#8E3A4A; font-weight:600;"
            >
              👉 Neuen Termin auswählen
            </a>
          </p>

          <p>
            Falls etwas nicht funktioniert, melde dich jederzeit unter
            <strong>hallo@mypoise.de</strong>.
          </p>

          <br />

          <p>
            Alles Liebe<br/>
            ${therapistName} 🤍
          </p>
        `,
      }),
    });

    if (!mailRes.ok) {
      const mailText = await mailRes.text().catch(() => "");
      console.warn("⚠️ MAIL FAILED – DB OK", mailText);
    } else {
      console.log("📧 MAIL SENT");
    }

    return json({
      ok: true,
      requestId,
      therapistName,
      therapistId,
    });
  } catch (err) {
    console.error("🔥 SERVER ERROR:", err);
    return json(
      { error: "server_error", detail: String(err) },
      500
    );
  }
}
