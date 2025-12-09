// app/api/match-client/route.js

import { supabase } from "../../../lib/supabase";

export async function POST(req) {
  try {
    const {
      anfrageId,          // r.id
      honorar,            // matchTarif
      therapistEmail,     // user.email
      nextDate,           // erste Sitzung
      duration            // Dauer in Minuten
    } = await req.json();

    if (!anfrageId || !honorar || !therapistEmail || !nextDate) {
      console.error("Missing fields:", {
        anfrageId,
        honorar,
        therapistEmail,
        nextDate,
        duration
      });
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400
      });
    }

    // 1) Anfrage auf active setzen
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        status: "active",
        honorar_klient: honorar
      })
      .eq("id", anfrageId);

    if (updateError) {
      console.error("UPDATE ERROR:", updateError);
      return new Response(JSON.stringify({ error: "update_failed" }), {
        status: 500
      });
    }

    // Preisberechnung
    const price = honorar;
    const commission = honorar * 0.3;
    const payout = honorar * 0.7;

    // 2) Erste Sitzung speichern
    const { error: sessionError } = await supabase
      .from("sessions")
      .insert({
        anfrage_id: anfrageId,
        therapist: therapistEmail,
        date: nextDate,
        duration_min: duration,
        price,
        commission,
        payout
      });

    if (sessionError) {
      console.error("SESSION ERROR:", sessionError);
      return new Response(JSON.stringify({ error: "session_failed" }), {
        status: 500
      });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });

  } catch (e) {
    console.error("SERVER ERROR:", e);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500
    });
  }
}
