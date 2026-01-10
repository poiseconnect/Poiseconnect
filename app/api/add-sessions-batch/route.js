import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ================= SUPABASE CLIENT ================= */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ================= POST ================= */

export async function POST(request) {
  try {
    /* ---------- BODY ---------- */
    const body = await request.json();
    const { anfrageId, therapist, sessions } = body || {};

    if (!anfrageId || !therapist || !Array.isArray(sessions)) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    /* ---------- ANFRAGE AUF AKTIV SETZEN ---------- */
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({ status: "active" })
      .eq("id", anfrageId);

    if (updateError) {
      console.error("UPDATE ANFRAGE ERROR:", updateError);
      throw updateError;
    }

    /* ---------- SESSIONS AUFBEREITEN ---------- */
    const rows = sessions
      .filter((s) => s?.date) // Schutz
      .map((s) => {
        const price = Number(s.price || 0);

        return {
          anfrage_id: anfrageId,
          therapist,
          date: !isNaN(Date.parse(s.date)) ? s.date : null,
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

    /* ---------- INSERT ---------- */
    const { error: insertError } = await supabase
      .from("sessions")
      .insert(rows);

    if (insertError) {
      console.error("INSERT SESSIONS ERROR:", insertError);
      throw insertError;
    }

    /* ---------- OK ---------- */
    return NextResponse.json({
      ok: true,
      inserted: rows.length,
    });
  } catch (err) {
    console.error("ADD SESSIONS ERROR:", err);

    return NextResponse.json(
      {
        error: "SERVER_ERROR",
        message:
          err?.message ||
          (typeof err === "string" ? err : "Unknown error"),
      },
      { status: 500 }
    );
  }
}
