import { NextResponse } from "next/server";
import { supabase } from "../../app/lib/supabase";

export async function POST(req) {
  try {
    const { id, honorar_klient, therapist, date, duration_min } =
      await req.json();

    // 1) Anfrage nur auf active setzen
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({ status: "active" })
      .eq("id", id);

    if (updateError) {
      console.error("UPDATE ERROR:", updateError);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    // Preisberechnung
    const price = Number(honorar_klient);
    const commission = price * 0.3;
    const payout = price * 0.7;

    // 2) Erste Sitzung speichern
    const { error: sessionError } = await supabase.from("sessions").insert({
      anfrage_id: id,
      therapist,
      date,
      duration_min,
      price,
      commission,
      payout,
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
