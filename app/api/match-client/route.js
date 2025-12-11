export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function POST(req) {
  try {
    const body = await req.json();

    const anfrageId = body.anfrageId;
    const honorar = body.honorar;
    const therapistEmail = body.therapistEmail;
    const nextDate = body.nextDate;
    const duration = body.duration;

    if (!anfrageId) {
      return NextResponse.json(
        { error: "missing_anfrageId" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("anfragen")
      .update({ status: "active" })
      .eq("id", anfrageId);

    if (updateError) {
      return NextResponse.json(
        { error: "update_failed", detail: updateError.message },
        { status: 500 }
      );
    }

    const price = Number(honorar);
    const commission = price * 0.3;
    const payout = price * 0.7;

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
      return NextResponse.json(
        { error: "session_failed", detail: sessionError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (e) {
    return NextResponse.json(
      { error: "server_error", detail: String(e) },
      { status: 500 }
    );
  }
}
