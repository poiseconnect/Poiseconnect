import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function POST(req) {
  try {
    // ✅ IMMER req.json()
    const body = await req.json();

    const {
      anfrageId,
      therapist,
      date,
      duration,
      price,
    } = body;

    if (!anfrageId || !therapist || !date || !price) {
      return NextResponse.json(
        { error: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    const p = Number(price);
    const commission = p * 0.3;
    const payout = p * 0.7;

    const { error } = await supabase
      .from("sessions")
      .insert({
        anfrage_id: anfrageId,
        therapist,
        date,
        duration_min: duration,
        price: p,
        commission,
        payout,
      });

    if (error) {
      console.error("INSERT ERROR:", error);
      return NextResponse.json(
        { error: "SESSION_FAILED", detail: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("SERVER ERROR (add-session):", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
