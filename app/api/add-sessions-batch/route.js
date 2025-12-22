import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { anfrageId, therapist, sessions, price } = body || {};

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
      date:
        s.date && !isNaN(Date.parse(s.date))
          ? s.date
          : null,
      duration_min: Number(s.duration),
      price: Number(price),
      commission: price ? price * 0.3 : null,
      payout: price ? price * 0.7 : null,
    }));

    const { error: insertError } = await supabase
      .from("sessions")
      .insert(rows);

    if (insertError) throw insertError;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("ADD SESSIONS ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
