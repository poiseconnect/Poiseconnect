import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      anfrageId,
      honorar,
      therapistEmail,
      nextDate,
      duration
    } = body;

    if (!anfrageId || !honorar || !therapistEmail) {
      return NextResponse.json(
        { error: "missing_fields", body },
        { status: 400 }
      );
    }

    // --- Anfrage auf active setzen
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        status: "active",
        honorar_klient: honorar
      })
      .eq("id", anfrageId);

    if (updateError) {
      console.error("UPDATE ERROR:", updateError);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    // Preisberechnung
    const price = honorar;
    const commission = honorar * 0.3;
    const payout = honorar * 0.7;

    // --- Erste Sitzung anlegen
    const { error: insertError } = await supabase
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

    if (insertError) {
      console.error("SESSION ERROR:", insertError);
      return NextResponse.json({ error: "session_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (e) {
    console.error("SERVER ERROR:", e);
    return NextResponse.json(
      { error: "server_exception", detail: String(e) },
      { status: 500 }
    );
  }
}
