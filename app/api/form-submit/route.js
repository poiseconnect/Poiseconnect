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
    const therapist = body.wunschtherapeut || body.therapist_from_url || null;

    if (!therapist) {
      return JSONResponse({ error: "THERAPIST_MISSING" }, 400);
    }

    // -----------------------------------------
    // 2️⃣ Termin normalisieren (ISO)
    // -----------------------------------------
    const terminISO = body.terminISO || null;
    const startAt = terminISO ? new Date(terminISO) : null;
    const endAt = startAt ? new Date(startAt.getTime() + 60 * 60000) : null;

    // -----------------------------------------
    // 🧠 ANLIEGEN: CHECKBOXEN + FREITEXT (🔥 FIX)
    // -----------------------------------------
    let anliegenText = "";

    // Checkboxen (Step 0)
    if (Array.isArray(body.themen) && body.themen.length > 0) {
      anliegenText += "Ausgewählte Themen:\n";
      body.themen.forEach((t) => {
        anliegenText += `• ${t}\n`;
      });
    }

    // Freitext
    if (body.anliegen && String(body.anliegen).trim()) {
      anliegenText +=
        (anliegenText ? "\n" : "") + "Freitext:\n" + String(body.anliegen).trim();
    }

    // -----------------------------------------
    // 3️⃣ Anfrage speichern
    // -----------------------------------------
    const payload = {
      vorname: body.vorname || null,
      nachname: body.nachname || null,
      email: body.email || null,

      // ✅ FIX: Telefon wirklich speichern (sonst bleibt 0/leer)
      telefon: body.telefon ? String(body.telefon).trim() : null,

      // ✅ FIX: Adresse-Felder richtig mappen (nicht body.adresse)
      strasse_hausnr: body.strasse_hausnr || null,
      plz_ort: body.plz_ort || null,

      geburtsdatum: body.geburtsdatum || null,
      beschaeftigungsgrad: body.beschaeftigungsgrad || null,

      leidensdruck: body.leidensdruck || null,
      anliegen: anliegenText || null,
      verlauf: body.verlauf || null,
      ziel: body.ziel || null,

      wunschtherapeut: therapist,
      bevorzugte_zeit: terminISO,

      check_suizid: Boolean(body.check_gesundheit),
      check_datenschutz: Boolean(body.check_datenschutz),
      check_online_setting: Boolean(body.check_online_setting),

      status: "neu",
      match_state: "pending",
    };

    const { data: inserted, error: insertError } = await supabase
      .from("anfragen")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      console.error("❌ Insert Error:", insertError);
      return JSONResponse(
        { error: "DB_INSERT_FAILED", detail: insertError.message },
        500
      );
    }

    // -----------------------------------------
    // 4️⃣ SLOT BLOCKIEREN (blocked_slots)
    // -----------------------------------------
    if (startAt && endAt) {
      const { error: blockError } = await supabase.from("blocked_slots").insert({
        anfrage_id: inserted.id,
        therapist_name: therapist,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        reason: "client_submit",
      });

      if (blockError) {
        console.error("❌ SLOT BLOCK ERROR:", blockError);
        // ❗ absichtlich kein Abbruch
      }
    }

    // -----------------------------------------
    // 5️⃣ Emails (wie gehabt)
    // -----------------------------------------
    const resendKey = process.env.RESEND_API_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://poiseconnect.vercel.app";

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
          <p>
            Vielen Dank für deine Anfrage!
            Deine ausgewählte Begleitung <strong>${therapist}</strong>
            meldet sich so bald wie möglich bei dir.
          </p>
          <p>🤍 Dein Poise Team</p>
        `
      );

      await sendMail(
        "hallo@mypoise.de",
        `Neue Anfrage von ${clientName}`,
        `
          <h2>Neue Anfrage</h2>
          <p><strong>Name:</strong> ${clientName}</p>
          <p><strong>Email:</strong> ${body.email}</p>
          <p><strong>Telefon:</strong> ${body.telefon || "—"}</p>
          <p><strong>Anliegen:</strong><br/>${anliegenText || "—"}</p>
          <p><strong>Therapeut:</strong> ${therapist}</p>
          <p><strong>Termin:</strong> ${terminISO || "—"}</p>
          <br/>
          <a href="${baseUrl}/dashboard">➡ Zum Dashboard</a>
        `
      );
    }

    // -----------------------------------------
    // 6️⃣ OK
    // -----------------------------------------
    return JSONResponse({ ok: true });
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    return JSONResponse({ error: "SERVER_ERROR", detail: String(err) }, 500);
  }
}
