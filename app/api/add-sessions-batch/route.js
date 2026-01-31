import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    // 🔴 WICHTIG: request.json(), NICHT req.json()
    const body = await request.json();
    const { anfrageId, therapist, sessions } = body || {};

    if (!anfrageId || !therapist || !Array.isArray(sessions)) {
      return NextResponse.json(
        { error: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const cleanSessions = sessions
      .filter((s) => s?.date)
      .map((s) => ({
        anfrage_id: anfrageId,
        therapist,
        date: new Date(s.date).toISOString(),
        duration_min: Number(s.duration),
        price: Number(s.price),
      }));

    if (!cleanSessions.length) {
      return NextResponse.json(
        { error: "NO_VALID_SESSIONS" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("sessions")
      .insert(cleanSessions);

    if (error) {
      console.error("ADD SESSIONS ERROR", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("ADD SESSIONS SERVER ERROR", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
