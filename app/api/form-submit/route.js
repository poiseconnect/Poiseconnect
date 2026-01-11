export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

// -----------------------------------------
// 🔧 JSON Helper
// -----------------------------------------
function JSONResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// -----------------------------------------
// 🔧 Supabase Client (Service Role)
// -----------------------------------------
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ ENV fehlt", { url: !!url, key: !!key });
    return null;
  }

  return createClient(url, key);
}

// -----------------------------------------
// 🚀 POST: FORMULAR ABSENDEN
// -----------------------------------------
export async function POST(req) {
  try {
    const body = await req.json();
    const supabase = getSupabase();
    if (!supabase) {
      return JSONResponse({ error: "SUPABASE_NOT_CONFIGURED" }, 500);
    }

    // -----------------------------------------
    // 1️⃣ Wunschtherapeut sauber ermitteln
    // -----------------------------------------
    let therapist =
      body.wunschtherapeut ||
      body.therapist_from_url ||
      null;

    if (!therapist) {
      return JSONResponse(
        { error: "THERAPIST_MISSING", detail: "wunschtherapeut leer" },
        400
      );
    }

    // -----------------------------------------
    // 2️⃣ Termin sauber normalisieren
    // -----------------------------------------
    const bevorzugteZeit =
      body.terminDisplay && !isNaN(Date.parse(body.terminDisplay))
        ? body.terminDisplay
        : null;

    // -----------------------------------------
    // 3️⃣ Payload (NULL statt EMPTY)
    // -----------------------------------------
    const payload = {
      vorname: body.vorname || null,
      nachname: body.nachname || null,
      email: body.email || null,

      strasse_hausnr: body.adresse || null,
      plz_ort: body.plz_ort || null,

      geburtsdatum: body.geburtsdatum || null,
      beschaeftigungsgrad: body.beschaeftigungsgrad || null,

      leidensdruck: body.leidensdruck || null,
      anliegen: body.anliegen || null,
      verlauf: body.verlauf || null,
      ziel: body.ziel || null,

      wunschtherapeut: therapist,
      bevorzugte_zeit: body.terminISO || null,


      check_suizid: Boolean(body.check_gesundheit),
      check_datenschutz: Boolean(body.check_datenschutz),
      check_online_setting: Boolean(body.check_online_setting),

      status: "neu",
match_state: "pending", // 👈 NEU

    };

    // -----------------------------------------
    // 4️⃣ Insert
    // -----------------------------------------
    const { error } = await supabase
      .from("anfragen")
      .insert(payload);

    if (error) {
      console.error("❌ Insert Error:", error);
      return JSONResponse(
        { error: "DB_INSERT_FAILED", detail: error.message },
        500
      );
    }

    // -----------------------------------------
    // 5️⃣ Emails (unverändert)
    // -----------------------------------------
    const resendKey = process.env.RESEND_API_KEY;
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://poiseconnect.vercel.app";

    if (resendKey) {
      const sendMail = (to, subject, html) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Poise <noreply@mypoise.de>",
            to,
            subject,
            html,
          }),
        });

      const clientName = `${body.vorname} ${body.nachname}`;

      await sendMail(
        body.email,
        "Deine Anfrage ist eingegangen 🤍",
        `
          <h2>Hallo ${body.vorname},</h2>
          <p>Vielen Dank für deine Anfrage! Deine ausgewählte Begleitung <strong>${therapist}</strong> meldet sich so bald wie möglich bei dir.</p>
          <br/>
          <p>🤍 Dein Poise Team</p>
        `
      );

      await sendMail(
        "hallo@mypoise.de",
        `Neue Anfrage eingegangen von ${clientName}`,
        `
          <h2>Neue Anfrage</h2>
          <p><strong>Name:</strong> ${clientName}</p>
          <p><strong>Email:</strong> ${body.email}</p>
          <p><strong>Anliegen:</strong> ${body.anliegen}</p>
          <p><strong>Therapeut:</strong> ${therapist}</p>
          <p><strong>Termin:</strong> ${bevorzugteZeit || "—"}</p>
          <br/>
          <a href="${baseUrl}/dashboard">➡ Zum Dashboard</a>
        `
      );

      await sendMail(
        therapist,
        `Neue Anfrage für dich von ${clientName}`,
        `
          <h2>Neue Anfrage 🤍</h2>
          <p><strong>Name:</strong> ${clientName}</p>
          <p><strong>Email:</strong> ${body.email}</p>
          <p><strong>Anliegen:</strong> ${body.anliegen}</p>
          <p><strong>Terminwunsch:</strong> ${bevorzugteZeit || "—"}</p>
          <br/>
          <a href="${baseUrl}/dashboard">➡ Im Dashboard ansehen</a>
        `
      );
    }

    // -----------------------------------------
    // 6️⃣ OK
    // -----------------------------------------
    return JSONResponse({ ok: true });
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    return JSONResponse(
      { error: "SERVER_ERROR", detail: String(err) },
      500
    );
  }
}
