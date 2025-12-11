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

    const anfrageId = body?.anfrageId;
    const honorar = body?.honorar;
    const therapistEmail = body?.therapistEmail;
    const nextDate = body?.nextDate;
    const duration = body?.duration;

    console.log("BODY RECEIVED:", body);

    if (!anfrageId) return json({ error: "missing_anfrageId" }, 400);

    // 1) Anfrage auf active setzen
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({ status: "active" })
      .eq("id", anfrageId);

    if (updateError) {
      console.error("UPDATE ERROR:", updateError);
      return json({ error: "update_failed", detail: updateError }, 500);
    }

    // 2) Session speichern
    const price = Number(honorar);
    const commission = price * 0.3;
    const payout = price * 0.7;

    const { error: sessionError } = await supabase.from("sessions").insert({
      anfrage_id: anfrageId,
      therapist: therapistEmail,
      date: nextDate,
      duration_min: duration,
      price,
      commission,
      payout,
    });

    if (sessionError) {
      console.error("SESSION ERROR:", sessionError);
      return json({ error: "session_failed", detail: sessionError }, 500);
    }

    return json({ ok: true }, 200);
  } catch (e) {
    console.error("SERVER ERROR:", e);
    return json({ error: "server_error", detail: String(e) }, 500);
  }
}
