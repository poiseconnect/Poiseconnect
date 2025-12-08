import { supabase } from "../../lib/supabase";

export async function POST(req) {
  try {
    const {
      id,               // Anfrage-ID
      therapist,        // user.email
      date,             // Datum der Sitzung
      duration_min      // Dauer in Minuten
    } = await req.json();

    // 1. Honorar der Anfrage laden
    const { data: row, error: loadError } = await supabase
      .from("anfragen")
      .select("honorar_klient")
      .eq("id", id)
      .single();

    if (loadError || !row) {
      console.error("LOAD ERROR:", loadError);
      return new Response(
        JSON.stringify({ error: "tarif_missing" }),
        { status: 500 }
      );
    }

    const honorar = row.honorar_klient;

    // 2. Preis- und Provisionsberechnung
    const price = honorar;
    const commission = honorar * 0.3;
    const payout = honorar * 0.7;

    // 3. Sitzung speichern
    const { error: insertError } = await supabase
      .from("sessions")
      .insert({
        anfrage_id: id,
        therapist: therapist,
        date: date,
        duration_min: duration_min,
        price,
        commission,
        payout
      });

    if (insertError) {
      console.error("INSERT ERROR:", insertError);
      return new Response(
        JSON.stringify({ error: "session_failed" }),
        { status: 500 }
      );
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return new Response(JSON.stringify({ error: "server_error" }), {
      status: 500,
    });
  }
}
