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
    console.log("📥 UPDATE-CLIENT BODY:", body);

    const {
      requestId,
      client,
      therapistName,
      therapistId,   // ✅ NEU
      vorname,
      oldSlot,
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

    if (!therapistId) {
      return json(
        {
          error: "missing_therapist_id",
          hint: "therapistId fehlt im Request-Body",
        },
        400
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://poiseconnect.vercel.app";

    /* ===============================
       1) Alten Termin blockieren
    =============================== */
    if (oldSlot) {
      const start = new Date(oldSlot);

      if (isNaN(start.getTime())) {
        return json({ error: "invalid_oldSlot" }, 400);
      }

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
        return json(
          { error: "block_failed", detail: blockError.message },
          500
        );
      }

      console.log("✅ SLOT BLOCKED:", start.toISOString());
    }

    /* ===============================
       2) Anfrage sauber zurücksetzen
    =============================== */
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        status: "termin_neu",
        match_state: "reschedule",
        bevorzugte_zeit: null,
        terminISO: null,
        termin_iso: null,
        terminDisplay: null,
        booking_token: null,

        // 🔥 ENTSCHEIDEND
        wunschtherapeut: therapistName,
        assigned_therapist_id: therapistId,
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("❌ UPDATE REQUEST ERROR:", updateError);
      return json(
        { error: "update_failed", detail: updateError.message },
        500
      );
    }

    console.log("✅ REQUEST UPDATED WITH THERAPIST:", {
      requestId,
      therapistName,
      therapistId,
    });

    /* ===============================
       3) Mail mit Reschedule-Link
    =============================== */
    const link =
      `${baseUrl}?resume=10&anfrageId=${encodeURIComponent(requestId)}`;

    console.log("🔗 RESCHEDULE LINK:", link);

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

          <p>dein ursprünglich geplanter Termin kann so leider nicht stattfinden.</p>

          <p>Bitte wähle hier ganz einfach einen neuen Termin aus:</p>

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
            Sobald du einen neuen Termin gewählt hast, kümmern wir uns direkt um alles Weitere.
          </p>

          <p>
            Falls du Fragen hast oder Unterstützung brauchst, melde dich jederzeit gerne unter
            <strong>hallo@mypoise.de</strong>.
          </p>

          <br />

          <p>
            Alles Liebe<br/>
            ${therapistName || "Dein Coach"} 🤍
          </p>
        `,
      }),
    });

    if (!mailRes.ok) {
      const mailText = await mailRes.text().catch(() => "");
      console.warn("⚠️ MAIL FAILED – DB OK", mailText);
    } else {
      console.log("✅ MAIL SENT");
    }

    return json({ ok: true });
  } catch (err) {
    console.error("🔥 UPDATE-CLIENT SERVER ERROR:", err);
    return json(
      { error: "server_error", detail: String(err) },
      500
    );
  }
}
