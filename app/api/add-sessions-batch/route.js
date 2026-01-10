import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    /* ---------- HARD GUARD ---------- */
    if (!request || typeof request.json !== "function") {
      console.error("INVALID REQUEST OBJECT:", request);
      return NextResponse.json(
        { error: "INVALID_REQUEST_OBJECT" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { anfrageId, therapist, sessions } = body || {};

    if (!anfrageId || !therapist || !Array.isArray(sessions)) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    /* ---------- AKTIV SETZEN ---------- */
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({ status: "active" })
      .eq("id", anfrageId);

    if (updateError) throw updateError;

    /* ---------- ROWS ---------- */
    const rows = sessions
      .filter((s) => s?.date)
      .map((s) => {
        const price = Number(s.price || 0);

        return {
          anfrage_id: anfrageId,
          therapist,
          date: new Date(s.date).toISOString(),
          duration_min: Number(s.duration) || 60,
          price,
          commission: price * 0.3,
          payout: price * 0.7,
        };
      });

    if (!rows.length) {
      return NextResponse.json(
        { error: "NO_VALID_SESSIONS" },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase
      .from("sessions")
      .insert(rows);

    if (insertError) throw insertError;

    return NextResponse.json({
      ok: true,
      inserted: rows.length,
    });
  } catch (err) {
    console.error("ADD SESSIONS ERROR:", err);

    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
