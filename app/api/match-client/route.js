import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";  // ✅ absolut korrekt

export async function POST(req) {
  try {
    const body = await req.json();

    console.log("BODY RECEIVED:", body);

    const {
      anfrageId,
      honorar,
      therapistEmail,
      nextDate,
      duration
    } = body;

    if (!anfrageId) {
      return NextResponse.json({ error: "missing_anfrageId" }, { status: 400 });
    }

    // 1) Anfrage auf active setzen
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({ status: "active" })
      .eq("id", anfrageId);

    if (updateError) {
      console.error("UPDATE ERROR:", updateError);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    // Preisberechnung
    const price = Number(honorar);
    const commission = price * 0.3;
    const payout = price * 0.7;

    // 2) Sitzung speichern
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
      return NextResponse.json(
        { error: "session_failed", detail: sessionError },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
