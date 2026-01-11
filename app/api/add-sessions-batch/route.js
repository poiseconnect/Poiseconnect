export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { anfrageId, therapist, sessions } = body;

    if (!anfrageId || !therapist || !Array.isArray(sessions)) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    // 1️⃣ Anfrage aktiv setzen
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({ status: "active" })
      .eq("id", anfrageId);

    if (updateError) {
      console.error("UPDATE ERROR:", updateError);
      return NextResponse.json(
        { error: "UPDATE_FAILED" },
        { status: 500 }
      );
    }

    // 2️⃣ Sessions vorbereiten
    const rows = sessions.map((s) => ({
      anfrage_id: anfrageId,
      therapist,
      date: s.date,
      duration_min: Number(s.duration),
      price: Number(s.price),
      commission: Number(s.price) * 0.3,
      payout: Number(s.price) * 0.7,
    }));

    const { error: insertError } = await supabase
      .from("sessions")
      .insert(rows);

    if (insertError) {
      console.error("INSERT ERROR:", insertError);
      return NextResponse.json(
        { error: "INSERT_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("ADD SESSIONS SERVER ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
