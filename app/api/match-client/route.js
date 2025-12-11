export const dynamic = "force-dynamic";

import { supabase } from "../../lib/supabase";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req) {
  try {
    const body = await req.json();

    console.log("MATCH BODY:", body);

    const {
      anfrageId,
      honorar,
      therapistEmail,
      nextDate,
      duration,
    } = body;

    if (
      !anfrageId ||
      honorar === undefined ||
      !therapistEmail ||
      !nextDate ||
      !duration
    ) {
      return json({ error: "MISSING_FIELDS" }, 400);
    }

    const price = Number(honorar);
    if (isNaN(price)) {
      return json({ error: "INVALID_HONORAR" }, 400);
    }

    // 1️⃣ Anfrage aktiv setzen + Preis speichern
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        status: "active",
        honorar_klient: price, // ✅ ENTSCHEIDEND
      })
      .eq("id", anfrageId);

    if (updateError) {
      console.error("UPDATE ERROR:", updateError);
      return json({ error: "update_failed" }, 500);
    }

    // 2️⃣ Erste Sitzung anlegen
    const commission = price * 0.3;
    const payout = price * 0.7;

    const { error: sessionError } = await supabase
      .from("sessions")
      .insert({
        anfrage_id: anfrageId,
        therapist: therapistEmail,
        date: nextDate,
        duration_min: Number(duration),
        price,
        commission,
        payout,
      });

    if (sessionError) {
      console.error("SESSION ERROR:", sessionError);
      return json({ error: "session_failed" }, 500);
    }

    return json({ ok: true });

  } catch (err) {
    console.error("MATCH SERVER ERROR:", err);
    return json({ error: "server_error" }, 500);
  }
}
