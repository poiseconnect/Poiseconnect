export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

// Sichere JSON Antwort
function JSONResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

// Supabase Client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ SUPABASE ENV FEHLT:", {
      hasUrl: !!url,
      hasKey: !!key
    });
    return null;
  }
  return createClient(url, key);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const supabase = getSupabase();
    if (!supabase) {
      return JSONResponse({ error: "SUPABASE_NOT_CONFIGURED" }, 500);
    }

    // ----------------------------
    // 1️⃣ WUNSCHTHERAPEUT FIX
    // ----------------------------
    let therapist = body.wunschtherapeut;

    if (!therapist && body.therapist_from_url) {
      therapist = body.therapist_from_url;
    }

    if (!therapist) {
      return JSONResponse(
        { error: "THERAPIST_MISSING", detail: "wunschtherapeut ist leer" },
        400
      );
    }

    // ----------------------------
    // 2️⃣ INSERT INTO DATABASE
    // ----------------------------
    const insertPayload = {
      vorname: body.vorname,
      nachname: body.nachname,
      email: body.email,

      strasse_hausnr: body.adresse || "",
      plz_ort: body.plz_ort || "",

      geburtsdatum: body.geburtsdatum,
      beschaeftigungsgrad: body.beschaeftigungsgrad,

      leidensdruck: body.leidensdruck || "",
      anliegen: body.anliegen,
      verlauf: body.verlauf,
      ziel: body.ziel,

      wunschtherapeut: therapist,
      bevorzugte_zeit: body.terminDisplay || "",

      check_suizid: body.check_gesundheit || false,
      check_datenschutz: body.check_datenschutz || false,
      check_online_setting: body.check_online_setting || false,

      status: "neu"
    };

    const { error } = await supabase.from("anfragen").insert(insertPayload);

    if (error) {
      console.error("❌ DB ERROR:", error);
      return JSONResponse(
        { error: "DB_INSERT_FAILED", detail: error.message },
        500
      );
    }

    // ------------------------------------------------------
    // 3️⃣ EMAILS (3 Stück) – RESEND
    // ------------------------------------------------------
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://poiseconnect.vercel.app";

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const sendMail = (to, subject, html) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "Poise <noreply@mypoise.de>",
            to,
            subject,
            html
          })
        });

      const clientName = `${body.vorname} ${body.nachname}`;

      // 3.1 📩 Eingangsbestätigung an Klient
      sendMail(
        body.email,
        "Deine Anfrage bei Poise ist eingegangen 🤍",
        `
          <h2>Hallo ${body.vorname},</h2>
          <p>vielen Dank für deine Anfrage und dein Vertrauen.</p>
          <p>${therapist} wird sich zeitnah bei dir melden.</p>
          <p>Wir freuen uns, dich begleiten zu dürfen.</p>
          <br />
          <p>🤍 Dein Poise Team</p>
        `
      );

      // 3.2 📩 Kopie an Admin
      sendMail(
        "hallo@mypoise.de",
        `Neue Anfrage eingegangen von ${clientName}`,
        `
          <h2>Neue Anfrage</h2>
          <p><strong>Name:</strong> ${clientName}</p>
          <p><strong>Email:</strong> ${body.email}</p>
          <p><strong>Anliegen:</strong> ${body.anliegen}</p>
          <p><strong>Wunschtherapeut:</strong> ${therapist}</p>
          <p><strong>Terminwunsch:</strong> ${body.terminDisplay || "—"}</p>
          <br />
          <a href="${baseUrl}/dashboard">➡ Zum Dashboard</a>
        `
      );

      // 3.3 📩 Info an Teammitglied
      sendMail(
        therapist,
        `Neue Anfrage für dich von ${clientName}`,
        `
          <h2>Neue Anfrage für dich 🤍</h2>
          <p><strong>Name:</strong> ${clientName}</p>
          <p><strong>Email:</strong> ${body.email}</p>
          <p><strong>Anliegen:</strong> ${body.anliegen}</p>
          <p><strong>Bevorzugte Zeit:</strong> ${body.terminDisplay || "—"}</p>
          <br/>
          <a href="${baseUrl}/dashboard">➡ Anfrage im Dashboard öffnen</a>
        `
      );
    }

    // ----------------------------
    // 4️⃣ RESPONSE
    // ----------------------------
    return JSONResponse({ ok: true });
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    return JSONResponse(
      { error: "SERVER_ERROR", detail: String(err) },
      500
    );
  }
}
