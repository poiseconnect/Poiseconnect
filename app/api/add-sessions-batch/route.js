import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const { anfrageId, therapist, date, duration, price } = body;

    if (!anfrageId || !therapist || !date || !duration) {
      return NextResponse.json(
        { error: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("anfragen")
      .update({ status: "active" })
      .eq("id", anfrageId);

    if (updateError) {
      throw updateError;
    }

    const session = {
      anfrage_id: anfrageId,
      therapist,
      date,
      duration_min: Number(duration),
      price: price ?? null,
      commission: price ? price * 0.3 : null,
      payout: price ? price * 0.7 : null,
    };

    const { error: insertError } = await supabase
      .from("sessions")
      .insert(session);

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("ADD-SESSIONS-BATCH ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
