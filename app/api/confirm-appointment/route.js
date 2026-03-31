export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function safeDateString(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("de-AT");
}

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
       1️⃣ AKTUELLE ANFRAGE LADEN
    -------------------------------------------------- */
    const { data: existing, error: loadError } = await supabase
      .from("anfragen")
      .select(`
        id,
        status,
        bevorzugte_zeit,
        assigned_therapist_id,
        wunschtherapeut,
        meeting_link_override
      `)
      .eq("id", requestId)
      .single();

    if (loadError || !existing) {
      console.error("❌ LOAD REQUEST ERROR:", loadError);
      return new Response(
        JSON.stringify({ error: "request_not_found" }),
        { status: 404 }
      );
    }

    // ❗ Schon bestätigt → nichts tun
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
       3️⃣ BOOKING SETTINGS DES COACHS LADEN
    -------------------------------------------------- */
    let bookingSettings = null;

    if (existing.assigned_therapist_id) {
      const { data: bookingData, error: bookingError } = await supabase
        .from("therapist_booking_settings")
        .select("meeting_link")
        .eq("therapist_id", existing.assigned_therapist_id)
        .single();

      if (bookingError) {
        console.warn("⚠️ BOOKING SETTINGS LOAD FAILED:", bookingError);
      } else {
        bookingSettings = bookingData;
      }
    }

    const therapistName =
      existing.wunschtherapeut?.trim() || "dein Coach";

    const terminText = existing.bevorzugte_zeit
      ? safeDateString(existing.bevorzugte_zeit)
      : "wird dir separat mitgeteilt";

    const videoLink =
      existing.meeting_link_override ||
      bookingSettings?.meeting_link ||
      "";

    /* --------------------------------------------------
       4️⃣ MAIL AN KLIENT:IN
    -------------------------------------------------- */
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

          <p>
            dein Termin wurde erfolgreich bestätigt – wir freuen uns sehr auf dich.
          </p>

          <p>
            <strong>Dein Coach:</strong> ${therapistName}<br/>
            <strong>Termin:</strong> ${terminText}
          </p>

          <p>
            ${therapistName} freut sich darauf, dich kennenzulernen und dich ein Stück auf deinem Weg zu begleiten.
          </p>

          ${
            videoLink
              ? `
              <p>
                <strong>Video-Call:</strong><br/>
                <a href="${videoLink}" target="_blank" style="color:#6f4f49; font-weight:bold;">
                  Zum Gespräch
                </a>
              </p>
              `
              : ""
          }

          <p>
            Bitte plane dir ausreichend Zeit und einen ruhigen Ort für das Gespräch ein.
          </p>

          <p>
            Solltest du den Termin doch nicht wahrnehmen können, melde dich bitte rechtzeitig unter
            <a href="mailto:hallo@mypoise.de">hallo@mypoise.de</a>.
          </p>

          <p>
            Herzliche Grüße<br/>
            Sebastian<br/>
            Poise
          </p>
        `,
      }),
    });

    if (!mailRes.ok) {
      const mailText = await mailRes.text();
      console.warn("⚠️ MAIL FAILED – STATUS IST ABER KORREKT:", mailText);
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
