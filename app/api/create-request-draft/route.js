export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();

const {
  anfrageId,
  wunschtherapeut,
  assigned_therapist_id,
  coaching_typ,

  vorname,
  nachname,
  email,
  telefon,
  strasse_hausnr,
  plz_ort,
  geburtsdatum,
  beschaeftigungsgrad,

  structured_time_preference,
} = body || {};

    if (!assigned_therapist_id) {
      return json({ error: "ASSIGNED_THERAPIST_ID_MISSING" }, 400);
    }

const payload = {
  vorname: vorname || null,
  nachname: nachname || null,
  email: email || null,
  telefon: telefon || null,
  strasse_hausnr: strasse_hausnr || null,
  plz_ort: plz_ort || null,
  geburtsdatum: geburtsdatum || null,
  beschaeftigungsgrad: beschaeftigungsgrad || null,
wunschtherapeut: wunschtherapeut || null,
assigned_therapist_id,

coaching_typ:
  coaching_typ === "paar" ? "paar" : "einzel",

// Optionale grobe Zeitpräferenz vor der Coach-Auswahl (Version 1, kein Pflichtfeld).
// Alte Anfragen ohne dieses Feld bleiben unverändert funktionsfähig.
structured_time_preference: Array.isArray(structured_time_preference)
  ? structured_time_preference
  : null,

status: "draft",
match_state: "draft",
};

    if (anfrageId) {
      const { data, error } = await supabase
        .from("anfragen")
        .update(payload)
        .eq("id", anfrageId)
        .select("id, booking_token, assigned_therapist_id")
        .single();

      if (error) {
        console.error("DRAFT UPDATE ERROR:", { code: error?.code || null });
        return json({ error: "DRAFT_UPDATE_FAILED" }, 500);
      }

      return json({
        ok: true,
        id: data.id,
        booking_token: data.booking_token,
        assigned_therapist_id: data.assigned_therapist_id,
      });
    }

    const { data, error } = await supabase
      .from("anfragen")
      .insert({
        ...payload,
        booking_token: crypto.randomUUID(),
      })
      .select("id, booking_token, assigned_therapist_id")
      .single();

    if (error) {
      console.error("DRAFT INSERT ERROR:", { code: error?.code || null });
      return json({ error: "DRAFT_INSERT_FAILED" }, 500);
    }

    return json({
      ok: true,
      id: data.id,
      booking_token: data.booking_token,
      assigned_therapist_id: data.assigned_therapist_id,
    });
  } catch (err) {
    console.error("CREATE REQUEST DRAFT ERROR");
    return json({ error: "SERVER_ERROR", detail: "INTERNAL_ERROR" }, 500);
  }
}
