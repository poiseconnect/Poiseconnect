export const dynamic = "force-dynamic";

import { supabase } from "../../lib/supabase";

export async function POST(req) {
  try {
    const body = await req.json();

    console.log("ADD-SESSION BODY:", body);

    const {
      id,            // Anfrage-ID
      therapist,     // user.email
      date,          // Datum der Sitzung
      duration_min   // Dauer in Minuten
    } = body;

    if (!id || !date || !duration_min) {
      return new Response(
        JSON.stringify({ error: "missing_fields" }),
        { status: 400 }
      );
    }

    // 1) Honorar der Anfrage laden
    const { data: row, error: loadError } = await supabase
      .from("anfragen")
      .select("honorar_klient")
      .eq("id", id)
      .single();

    if (loadError || !row) {
      console.error("LOAD ERROR:", loadError);
      return new Response(
        JSON.stringify({ error: "tarif_missing", detail: loadError }),
        { status: 500 }
      );
    }

    const honorar = Number(row.honorar_klient);

    // 2) Preisberechnung
    const price = honorar;
    const commission = honorar * 0.3;
    const payout = honorar * 0.7;

    // 3) Sitzung speichern
    const { error: insertError } = await supabase
      .from("sessions")
      .insert({
        anfrage_id: id,
        therapist,
        date,
        duration_min,
        price,
        commission,
        payout,
      });

    if (insertError) {
      console.error("INSERT ERROR:", insertError);
      return new Response(
        JSON.stringify({ error: "session_failed", detail: insertError }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200 }
    );

  } catch (err) {
    console.error("ADD-SESSION SERVER ERROR:", err);
    return new Response(
      JSON.stringify({ error: "server_error", detail: String(err) }),
      { status: 500 }
    );
  }
}
