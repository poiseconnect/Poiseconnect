import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function POST(request) {
  try {
    const { anfrageId, sessions, therapist } = await request.json();

    if (!anfrageId || !Array.isArray(sessions) || !therapist) {
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
      therapist: therapist,
    }));

    const { error } = await supabase
      .from("sessions")
      .insert(inserts);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Serverfehler" },
      { status: 500 }
    );
  }
}
