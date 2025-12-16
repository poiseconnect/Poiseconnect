import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";



export async function POST(req) {
  try {
    const { anfrageId, sessions, price } = await req.json();

    if (!anfrageId || !Array.isArray(sessions) || !price) {
      return NextResponse.json(
        { error: "Ungültige Daten" },
        { status: 400 }
      );
    }

    const inserts = sessions
      .filter((s) => s.date)
      .map((s) => ({
        anfrage_id: anfrageId,
        date: s.date,
        duration_min: s.duration || 60,
        price: price,
      }));

    if (inserts.length === 0) {
      return NextResponse.json(
        { error: "Keine gültigen Sitzungen" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("sessions")
      .insert(inserts);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("add-sessions-batch error:", err);
    return NextResponse.json(
      { error: "Sitzungen konnten nicht gespeichert werden" },
      { status: 500 }
    );
  }
}
