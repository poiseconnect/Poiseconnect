import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function POST(request) {
  try {
    // ⚠️ request.json() NUR EINMAL
    const body = await request.json();

    const {
      anfrageId,
      therapist,
      date,
      duration,
      price,
    } = body;

    if (!anfrageId || !therapist || !date || !duration) {
      return NextResponse.json(
        { error: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    const sessionPrice =
      typeof price === "number" ? price : null;

    // Anfrage aktiv setzen
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({ status: "active" })
      .eq("id", anfrageId);

    if (updateError) {
      console.error("UPDATE ERROR:", updateError);
      return NextResponse.json(
        { error: "update_failed" },
        { status: 500 }
      );
    }

    const commission =
      sessionPrice !== null ? sessionPrice * 0.3 : null;
    const payout =
      sessionPrice !== null ? sessionPrice * 0.7 : null;

    const { error: insertError } = await supabase
      .from("sessions")
      .insert({
        anfrage_id: anfrageId,
        therapist,
        date,
        duration_min: Number(duration),
        price: sessionPrice,
        commission,
        payout,
      });

    if (insertError) {
      console.error("INSERT ERROR:", insertError);
      return NextResponse.json(
        { error: "session_failed" },
        { status: 500 }
      );
    }

    // ✅ NUR DAS
    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("ADD-SESSIONS-BATCH ERROR:", err);
    return NextResponse.json(
      { error: "server_error", detail: String(err) },
      { status: 500 }
    );
  }
}
