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
    const requestId = body.rid || body.anfrageId || null;

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

    const terminwunsch_text = body.terminwunsch_text || null;

    // -----------------------------------------
    // 🧠 Anliegen
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
    // 3️⃣ DB Payload
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
      terminwunsch_text,
      check_suizid: Boolean(body.check_gesundheit),
      check_datenschutz: Boolean(body.check_datenschutz),
      check_online_setting: Boolean(body.check_online_setting),
      status: "neu",
      match_state: "pending",
    };

    let finalRequestId = null;

    // =====================================
    // 🔁 ADMIN RESUME → UPDATE
    // =====================================
    if (requestId) {
      console.log("🔁 UPDATE bestehende Anfrage:", requestId);

      const { error: updateError } = await supabase
        .from("anfragen")
        .update({
          ...payload,
          status: "neu",
          admin_therapeuten: [],
        })
        .eq("id", requestId);

      if (updateError) {
        console.error("❌ UPDATE ERROR:", updateError);
        return JSONResponse(
          { error: "DB_UPDATE_FAILED", detail: updateError.message },
          500
        );
      }

      finalRequestId = requestId;
    } else {
      // =====================================
      // 🆕 NEUE ANFRAGE → INSERT
      // =====================================
      console.log("🆕 INSERT neue Anfrage");

      const {
        data: inserted,
        error: insertError,
      } = await supabase
        .from("anfragen")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) {
        console.error("❌ INSERT ERROR:", insertError);
        return JSONResponse(
          { error: "DB_INSERT_FAILED", detail: insertError.message },
          500
        );
      }

      finalRequestId = inserted.id;
    }

    // -----------------------------------------
    // 4️⃣ SLOT BLOCKIEREN
    // -----------------------------------------
    if (startAt && endAt) {
      const { error: slotError } = await supabase
        .from("blocked_slots")
        .insert({
          anfrage_id: finalRequestId,
          therapist_id: assignedTherapistId,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          reason: "client_submit",
        });

      if (slotError) {
        console.error("❌ SLOT ERROR:", slotError);
      }
    }

    // -----------------------------------------
    // 📧 MAILS
    // -----------------------------------------
    const terminText = terminISO
      ? new Date(terminISO).toLocaleString("de-AT")
      : "noch offen";

    // Klient
   
