export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

// Sicheres JSON
function JSONResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

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

    // ---------------------------------
    // 🔧 WUNSCHTHERAPEUT FIX
    // ---------------------------------
    let therapist = body.wunschtherapeut;

    // Falls resume=10 oder resume=8 aus URL kommt
    if (!therapist && body.therapist_from_url) {
      therapist = body.therapist_from_url;
    }

    if (!therapist) {
      return JSONResponse(
        { error: "THERAPIST_MISSING", detail: "wunschtherapeut ist leer" },
        400
      );
    }

    // ---------------------------------
    // 🔧 INSERT
    // ---------------------------------

    const { error } = await supabase.from("anfragen").insert({
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

      // ⭐ FIX: status existiert jetzt in Supabase
      status: "neu"
    });

    if (error) {
      console.error("❌ DB ERROR:", error);
      return JSONResponse(
        { error: "DB_INSERT_FAILED", detail: error.message },
        500
      );
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
