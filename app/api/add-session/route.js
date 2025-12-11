export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function POST(req) {
  try {
    const body = await req.json();

    console.log("ADD-SESSION BODY:", body);

    const {
      anfrageId,
      therapist,
      date,
      duration,
    } = body;

    if (!anfrageId || !therapist || !date || !duration) {
      return NextResponse.json(
        { error: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    // 🔹 Honorar aus Anfrage laden
    const { data: anfrage, error: loadError } = await supabase
      .from("anfragen")
      .select("honorar_klient")
      .eq("id", anfrageId)
      .single();

    if (loadError || !anfrage) {
      console.error("LOAD ERROR:", loadError);
      return NextResponse.json(
        { error: "HONORAR_NOT_FOUND" },
        { status: 500 }
      );
    }

    const price = Number(anfrage.honorar_klient);
    const commission = price * 0.3;
    const payout = price * 0.7;

    // 🔹 Session anlegen
    const { error: insertError } = await supabase
      .from("sessions")
      .insert({
        anfrage_id: anfrageId,
        therapist,
        date,
        duration_min: duration,
        price,
        commission,
        payout,
      });

    if (insertError) {
      console.error("INSERT ERROR:", insertError);
      return NextResponse.json(
        { error: "SESSION_INSERT_FAILED", detail: insertError },
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
