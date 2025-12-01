export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// -------------------------------------
// Supabase Client
// -------------------------------------
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ SUPABASE ENV FEHLT:", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }
  return createClient(url, key);
}

// -------------------------------------
// POST /api/therapist-response
// -------------------------------------
export async function POST(req) {
  try {
    // 🔥 Wichtig: Body korrekt lesen
    const body = await req.json();

    const { 
      email,
      therapist,
      approved,
      terminISO,
      terminDisplay 
    } = body;

    if (!email || !therapist) {
      return NextResponse.json(
        { error: "MISSING_PARAMS" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "SUPABASE_NOT_CONFIGURED" },
        { status: 500 }
      );
    }

    // -------------------------------------
    // 1) Wenn Termin akzeptiert wurde → in confirmed_appointments schreiben
    // -------------------------------------
    if (approved) {
      const { error } = await supabase
        .from("confirmed_appointments")
        .insert({
          email,
          therapist,
          termin_iso: terminISO,
          termin_display: terminDisplay,
        });

      if (error) {
        console.error("❌ DB ERROR:", error);
        return NextResponse.json(
          { error: "DB_INSERT_FAILED", detail: error.message },
          { status: 500 }
        );
      }
    }

    // -------------------------------------
    // 2) Response JSON zurückgeben
    // -------------------------------------
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ SERVER ERROR in therapist-response:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
