export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

/**
 * ⚠️ WICHTIG:
 * In app/api darf KEIN Client-Supabase verwendet werden.
 */
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

export async function POST(request) {
  try {
    const body = await request.json();
const {
  vorname,
  nachname,
  email,
  telefon,
  strasse_hausnr,
  plz_ort,
  geburtsdatum,
  beschaeftigungsgrad,
  wunschtherapeut,
  therapist_id,
} = body || {};
    if (!vorname || !nachname || !wunschtherapeut || !therapist_id) {
  return json({ error: "MISSING_FIELDS" }, 400);
    }

const { error } = await supabase.from("anfragen").insert({
  vorname,
  nachname,
  email: email || null,
  telefon: telefon || null,
  strasse_hausnr: strasse_hausnr || null,
  plz_ort: plz_ort || null,
  geburtsdatum: geburtsdatum || null,
  beschaeftigungsgrad: beschaeftigungsgrad || null,
  wunschtherapeut,
  assigned_therapist_id: therapist_id,
  status: "active",
  quelle: "bestand",
});

    if (error) {
      console.error("CREATE BESTAND DB ERROR:", error);
      return json(
        { error: "DB_ERROR", detail: error.message },
        500
      );
    }

    return json({ ok: true });
  } catch (err) {
    console.error("CREATE BESTAND SERVER ERROR:", err);
    return json(
      { error: "SERVER_ERROR", detail: String(err) },
      500
    );
  }
}
