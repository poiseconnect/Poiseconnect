import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    console.log("BODY RECEIVED:", body);

    if (!anfrageId) {
      return NextResponse.json(
        { error: "missing_anfrageId" },
        { status: 400 }
      );
    }

    // ❗ SERVER-SUPABASE-CLIENT
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1) Anfrage auf "active" setzen
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

    // 2) Erste Sitzung speichern
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
      return NextResponse.json({ error: "session_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (e) {
    console.error("SERVER ERROR:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
