import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function POST(request) {
  try {
    const body = await request.json();
    const { anfrageId, therapist, sessions } = body || {};

    if (!anfrageId || !therapist || !Array.isArray(sessions)) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    // Anfrage aktiv setzen
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({ status: "active" })
      .eq("id", anfrageId);

    if (updateError) throw updateError;

    // Sessions vorbereiten
    const rows = sessions.map((s) => ({
      anfrage_id: anfrageId,
      therapist,
      date: s.date,
      duration_min: Number(s.duration),
      price: Number(s.price),
      commission: s.price ? s.price * 0.3 : null,
      payout: s.price ? s.price * 0.7 : null,
    }));

    const { error: insertError } = await supabase
      .from("sessions")
      .insert(rows);

    if (insertError) throw insertError;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("MATCH CLIENT ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
