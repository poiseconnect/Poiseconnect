import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function POST(request) {
  try {
    const body = await request.json();

    const { anfrageId, sessions, therapist } = body;

    if (!anfrageId || !Array.isArray(sessions) || sessions.length === 0) {
      return NextResponse.json(
        { error: "Ungültige Daten" },
        { status: 400 }
      );
    }

    const inserts = sessions.map((s) => ({
      anfrage_id: anfrageId,
      date: s.date,
      duration_min: s.duration,
      price: Number(s.price),
    
    }));

    const { error } = await supabase.from("sessions").insert(inserts);

    if (error) {
      console.error("DB insert error", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("add-sessions-batch error", err);
    return NextResponse.json(
      { error: "Serverfehler", detail: err.message },
      { status: 500 }
    );
  }
}
