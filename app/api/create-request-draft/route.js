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
      vorname,
      nachname,
      email,
      telefon,
      strasse_hausnr,
      plz_ort,
      geburtsdatum,
      beschaeftigungsgrad,
      anliegen,
      themen,
      leidensdruck,
      verlauf,
      diagnose,
      ziel,
      wunschtherapeut,
      assigned_therapist_id,
      check_datenschutz,
      check_online_setting,
      check_gesundheit,
    } = body || {};

    if (!assigned_therapist_id) {
      return json({ error: "ASSIGNED_THERAPIST_ID_MISSING" }, 400);
    }

    let anliegenText = "";

    if (Array.isArray(themen) && themen.length) {
      anliegenText += "Ausgewählte Themen:\n";
      themen.forEach((t) => {
        anliegenText += `• ${t}\n`;
      });
    }

    if (anliegen?.trim()) {
      anliegenText += (anliegenText ? "\n\n" : "") + anliegen.trim();
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
      leidensdruck: leidensdruck || null,
      verlauf: verlauf || null,
      diagnose: diagnose || null,
      ziel: ziel || null,
      anliegen: anliegenText || null,
      wunschtherapeut: wunschtherapeut || null,
      assigned_therapist_id: assigned_therapist_id || null,
      check_datenschutz: !!check_datenschutz,
      check_online_setting: !!check_online_setting,
      check_suizid: !!check_gesundheit,
      status: "neu",
      match_state: "pending",
    };

    if (anfrageId) {
      const { data, error } = await supabase
        .from("anfragen")
        .update(payload)
        .eq("id", anfrageId)
        .select("id, booking_token, assigned_therapist_id")
        .single();

      if (error) {
        console.error("DRAFT UPDATE ERROR:", error);
        return json({ error: error.message }, 500);
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
      console.error("DRAFT INSERT ERROR:", error);
      return json({ error: error.message }, 500);
    }

    return json({
      ok: true,
      id: data.id,
      booking_token: data.booking_token,
      assigned_therapist_id: data.assigned_therapist_id,
    });
  } catch (err) {
    console.error("CREATE REQUEST DRAFT ERROR:", err);
    return json(
      { error: "SERVER_ERROR", detail: String(err) },
      500
    );
  }
}
