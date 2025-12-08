import { supabase } from "../../lib/supabase";

export async function POST(req) {
  try {
    const {
      id,                  // Anfrage-ID
      honorar_klient,      // Stundensatz
      therapist,           // user.email
      date,                // erste Sitzung
      duration_min         // Dauer in Minuten
    } = await req.json();

    // 1) Anfrage auf active setzen
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        status: "active",
        honorar_klient: honorar_klient
      })
      .eq("id", id);

    if (updateError) {
      console.error("UPDATE ERROR:", updateError);
      return new Response(
        JSON.stringify({ error: "update_failed" }),
        { status: 500 }
      );
    }

    // Preis berechnen
    const price = honorar_klient;
    const commission = honorar_klient * 0.3;
    const payout = honorar_klient * 0.7;

    // 2) Erste Sitzung eintragen
    const { error: sessionError } = await supabase
      .from("sessions")
      .insert({
        anfrage_id: id,
        therapist: therapist,
        date: date,
        duration_min: duration_min,
        price: price,
        commission: commission,
        payout: payout
      });

    if (sessionError) {
      console.error("SESSION ERROR:", sessionError);
      return new Response(
        JSON.stringify({ error: "session_failed" }),
        { status: 500 }
      );
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });

  } catch (e) {
    console.error("SERVER ERROR:", e);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500
    });
  }
}
