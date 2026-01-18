import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* =========================================================
   SUPABASE (Service Role – Server only)
========================================================= */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* =========================================================
   POST /api/add-sessions-batch
========================================================= */

export async function POST(req) {
  try {
    const body = await req.json();

    const { anfrageId, therapist, sessions } = body;

    // ---------- VALIDIERUNG ----------
    if (!anfrageId || !therapist || !Array.isArray(sessions)) {
      return NextResponse.json(
        { error: "Ungültige Parameter" },
        { status: 400 }
      );
    }

    // ---------- SESSIONS AUFBEREITEN ----------
    const cleanSessions = sessions
      .filter(
        (s) =>
          s?.date &&
          typeof s.date === "string" &&
          s.date.trim() !== ""
      )
      .map((s) => ({
        anfrage_id: anfrageId,
        therapist,
        date: new Date(s.date).toISOString(),
        duration_min: Number(s.duration) || 60,
        price: Number(s.price) || 0,
      }));

    if (cleanSessions.length === 0) {
      return NextResponse.json(
        { error: "Keine gültigen Sitzungen übergeben" },
        { status: 400 }
      );
    }

    // ---------- INSERT ----------
    const { error } = await supabase
      .from("sessions")
      .insert(cleanSessions);

    if (error) {
      console.error("ADD SESSIONS DB ERROR:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // ---------- OK ----------
    return NextResponse.json({
      success: true,
      inserted: cleanSessions.length,
    });
  } catch (err) {
    console.error("ADD SESSIONS SERVER ERROR:", err);
    return NextResponse.json(
      { error: "Serverfehler beim Speichern der Sitzung" },
      { status: 500 }
    );
  }
}
