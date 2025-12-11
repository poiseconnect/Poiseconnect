import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      anfrageId,
      therapist,
      date,
      duration,
      price,       // ⬅️ kommt vom Frontend
    } = body;

    if (!anfrageId || !therapist || !date || !price) {
      return NextResponse.json(
        { error: "missing_fields" },
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
        { error: "session_failed", detail: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}
