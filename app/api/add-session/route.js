import { supabase } from "../../lib/supabase";

export async function POST(req) {
  const { anfrageId, therapist, date, duration } = await req.json();

  const { data: row, error: loadError } = await supabase
    .from("anfragen")
    .select("honorar_klient")
    .eq("id", anfrageId)
    .single();

  if (loadError) {
    console.error(loadError);
    return new Response(JSON.stringify({ error: "tarif_missing" }), { status: 500 });
  }

  const honorar = row.honorar_klient;
  const price = (honorar / 60) * duration;
  const commission = price * 0.3;
  const payout = price * 0.7;

  const { error: insertError } = await supabase
    .from("sessions")
    .insert({
      anfrage_id: anfrageId,
      therapist,
      date,
      duration_min: duration,
      price,
      commission,
      payout
    });

  if (insertError) {
    console.error(insertError);
    return new Response(JSON.stringify({ error: "session_failed" }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
