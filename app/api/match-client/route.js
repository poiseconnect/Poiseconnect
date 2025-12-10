export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

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
      return NextResponse.json(
        { error: "missing_anfrageId" },
        { status: 400 }
      );
    }

    // Anfrage auf active setzen
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({ status: "active" })
      .eq("id", anfrageId);

    if (updateError) {
      console.error("UPDATE ERROR:", updateError);
      return NextResponse.json(
        { error: "update_failed", detail: updateError },
        { status: 500 }
      );
    }

    // Preis
    const price = Number(honorar);
    const commission = price * 0.3;
    const payout = price * 0.7;

    // Sitzung eintragen
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

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json(
      { error: "server_error", detail: String(err) },
      { status: 500 }
    );
  }
}
