import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* =========================================================
   SUPABASE (Service Role – nur Server!)
========================================================= */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* =========================================================
   POST /api/update-session
========================================================= */

export async function POST(req) {
  try {
    const body = await req.json();
    const { sessionId, date, duration } = body;

    // ---------- VALIDIERUNG ----------
    if (!sessionId || !date) {
      return NextResponse.json(
        { error: "Ungültige Daten" },
        { status: 400 }
      );
    }

    // ---------- UPDATE ----------
    const { error } = await supabase
      .from("sessions")
      .update({
        date: new Date(date).toISOString(),
        duration_min: Number(duration) || null,
      })
      .eq("id", sessionId);

    if (error) {
      console.error("UPDATE SESSION DB ERROR:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // ---------- OK ----------
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("UPDATE SESSION SERVER ERROR:", err);
    return NextResponse.json(
      { error: "Serverfehler beim Aktualisieren der Sitzung" },
      { status: 500 }
    );
  }
}
