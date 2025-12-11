export const dynamic = "force-dynamic";

import { supabase } from "../../lib/supabase";

export async function POST(request) {
  try {
    const { anfrageId, therapist, date, duration } = await request.json();

    if (!anfrageId || !therapist || !date || !duration) {
      return new Response(
        JSON.stringify({ error: "MISSING_FIELDS" }),
        { status: 400 }
      );
    }

    // ✅ Preis aus ANFRAGEN holen (honorar_klient)
    const { data: anfrage, error: loadError } = await supabase
      .from("anfragen")
      .select("honorar_klient")
      .eq("id", anfrageId)
      .single();

    if (loadError || anfrage?.honorar_klient == null) {
      console.error("HONORAR NOT FOUND:", loadError);
      return new Response(
        JSON.stringify({ error: "HONORAR_NOT_FOUND" }),
        { status: 400 }
      );
    }

    const price = Number(anfrage.honorar_klient);
    const commission = price * 0.3;
    const payout = price * 0.7;

    const { error } = await supabase
      .from("sessions")
      .insert({
        anfrage_id: anfrageId,
        therapist,
        date,
        duration_min: Number(duration),
        price,
        commission,
        payout,
      });

    if (error) {
      console.error("INSERT ERROR:", error);
      return new Response(
        JSON.stringify({ error: "SESSION_INSERT_FAILED" }),
        { status: 500 }
      );
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });

  } catch (err) {
    console.error("SERVER ERROR (add-session):", err);
    return new Response(
      JSON.stringify({ error: "SERVER_ERROR" }),
      { status: 500 }
    );
  }
}
