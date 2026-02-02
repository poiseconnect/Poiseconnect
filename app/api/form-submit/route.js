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
    // 1️⃣ Wunschtherapeut
    // -----------------------------------------
    const therapist =
      body.wunschtherapeut ||
      body.therapist_from_url ||
      null;

    if (!therapist) {
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
    // 3️⃣ DB PAYLOAD (🔥 HIER WAR DER FEHLER)
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

  // 👇 Anzeige
  wunschtherapeut: therapist,

  // 🔥 ENTSCHEIDEND FÜR DASHBOARD & RECHTE
  assigned_therapist_id: assignedTherapistId,

  bevorzugte_zeit: terminISO,

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
        therapist_name: therapist,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        reason: "client_submit",
      });
    }

    return JSONResponse({ ok: true });
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    return JSONResponse(
      { error: "SERVER_ERROR", detail: String(err) },
      500
    );
  }
}
