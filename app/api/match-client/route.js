import { supabase } from "../../lib/supabase";

export async function POST(req) {
  const { anfrageId, honorar, therapistEmail, nextDate, duration } =
    await req.json();

  const { error: updateError } = await supabase
    .from("anfragen")
    .update({
      status: "active",
      honorar_klient: honorar
    })
    .eq("id", anfrageId);

  if (updateError) {
    console.error(updateError);
    return new Response(JSON.stringify({ error: "update_failed" }), { status: 500 });
  }

  const price = (honorar / 60) * duration;
  const commission = price * 0.3;
  const payout = price * 0.7;

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
    console.error(sessionError);
    return new Response(JSON.stringify({ error: "session_failed" }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
