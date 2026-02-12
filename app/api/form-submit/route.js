export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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
    const resend = new Resend(process.env.RESEND_API_KEY);

    if (!supabase) {
      return JSONResponse({ error: "SUPABASE_NOT_CONFIGURED" }, 500);
    }

    // -----------------------------------------
    // 1️⃣ Wunschtherapeut
    // -----------------------------------------
    const therapistName =
      body.wunschtherapeut ||
      body.therapist_from_url ||
      null;

    if (!therapistName) {
      return JSONResponse({ error: "THERAPIST_MISSING" }, 400);
    }

    const assignedTherapistId = body.assigned_therapist_id || null;
    if (!assignedTherapistId) {
      return JSONResponse(
        { error: "ASSIGNED_THERAPIST_ID_MISSING" },
        400
      );
    }

    // -----------------------------------------
    // 2️⃣ Termin
    // -----------------------------------------
    const terminISO = body.terminISO || null;
    const startAt = terminISO ? new Date(terminISO) : null;
    const endAt =
      startAt ? new Date(startAt.getTime() + 60 * 60000) : null;
    
    // 🔥 NEU – Textwunsch für Proposal Kalender
const terminwunsch_text = body.terminwunsch_text || null;

    // -----------------------------------------
    // 🧠 ANLIEGEN: Checkboxen + Freitext
    // -----------------------------------------
    let anliegenText = "";

    if (Array.isArray(body.themen) && body.themen.length > 0) {
      anliegenText += "Ausgewählte Themen:\n";
      body.themen.forEach((t) => {
        anliegenText += `• ${t}\n`;
      });
    }

    if (body.anliegen && body.anliegen.trim()) {
      anliegenText +=
        (anliegenText ? "\n\n" : "") +
        "Freitext:\n" +
        body.anliegen.trim();
    }

    // -----------------------------------------
    // 3️⃣ DB PAYLOAD
    // -----------------------------------------
    const payload = {
      vorname: body.vorname || null,
      nachname: body.nachname || null,
      email: body.email || null,
      telefon: body.telefon || null,

      strasse_hausnr: body.strasse_hausnr || null,
      plz_ort: body.plz_ort || null,

      geburtsdatum: body.geburtsdatum || null,
      beschaeftigungsgrad: body.beschaeftigungsgrad || null,

      leidensdruck: body.leidensdruck || null,
      anliegen: anliegenText || null,
      verlauf: body.verlauf || null,
      ziel: body.ziel || null,

      wunschtherapeut: therapistName,
      assigned_therapist_id: assignedTherapistId,
      bevorzugte_zeit: terminISO,
     terminwunsch_text: body.terminwunsch_text || null,

      check_suizid: Boolean(body.check_gesundheit),
      check_datenschutz: Boolean(body.check_datenschutz),
      check_online_setting: Boolean(body.check_online_setting),

      status: "neu",
      match_state: "pending",
    };

    const { data: inserted, error } = await supabase
      .from("anfragen")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      console.error("❌ Insert Error:", error);
      return JSONResponse(
        { error: "DB_INSERT_FAILED", detail: error.message },
        500
      );
    }

    // -----------------------------------------
    // 4️⃣ SLOT BLOCKIEREN
    // -----------------------------------------
    if (startAt && endAt) {
      await supabase.from("blocked_slots").insert({
        anfrage_id: inserted.id,
        therapist_id: assignedTherapistId,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        reason: "client_submit",
      });
    }

    // -----------------------------------------
    // 📧 MAILS
    // -----------------------------------------

    const terminText = terminISO
      ? new Date(terminISO).toLocaleString("de-AT")
      : "noch offen";

    // 📧 1) Klient:in
    if (body.email) {
      await resend.emails.send({
        from: "Poise <noreply@mypoise.de>",
        to: body.email,
        subject: "Deine Anfrage bei Poise 🤍",
        html: `
          <p>Liebe:r ${body.vorname || ""},</p>

          <p>vielen Dank für deine Anfrage bei <strong>Poise</strong>.</p>

          <p>
            Ausgewählte Therapeut:in:<br/>
            <strong>${therapistName}</strong>
          </p>

          <p>
            Erstgespräch:<br/>
            <strong>${terminText}</strong>
          </p>

          <p>Wir melden uns zeitnah bei dir.</p>

          <p>🤍<br/>Poise</p>
        `,
      });
    }

    // 📧 2) Therapeut:in
    if (body.therapist_email) {
      await resend.emails.send({
        from: "Poise <noreply@mypoise.de>",
        to: body.therapist_email,
        subject: "Neue Anfrage bei Poise",
        html: `
          <p>Hallo,</p>

          <p>es ist eine neue Anfrage eingegangen.</p>

          <p>
            Klient:in: <strong>${body.vorname} ${body.nachname}</strong><br/>
            Termin: <strong>${terminText}</strong>
          </p>

          <p>
            Bitte prüfe die Anfrage im Dashboard.
          </p>

          <p>– Poise</p>
        `,
      });
    }

    // 📧 3) Poise / Admin
    await resend.emails.send({
      from: "Poise <noreply@mypoise.de>",
      to: "hallo@mypoise.de",
      subject: "🆕 Neue Anfrage eingegangen",
      html: `
        <p><strong>Neue Anfrage</strong></p>

        <p>
          Klient:in: ${body.vorname} ${body.nachname}<br/>
          E-Mail: ${body.email}<br/>
          Therapeut:in: ${therapistName}<br/>
          Termin: ${terminText}
        </p>

        <p>Anfrage-ID: ${inserted.id}</p>
      `,
    });

    return JSONResponse({ ok: true });
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    return JSONResponse(
      { error: "SERVER_ERROR", detail: String(err) },
      500
    );
  }
}
