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
    const { anfrageId, therapist, sessions } = body || {};

    if (!anfrageId || !therapist || !Array.isArray(sessions) || sessions.length === 0) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    const rows = sessions.map((s) => {
      const date = s?.date;
      const duration_min = Number(s?.duration_min ?? s?.duration ?? 60);
      const price = Number(s?.price ?? 0);

      if (!date || !Number.isFinite(duration_min) || duration_min <= 0) {
        return null;
      }

      const commission = Number.isFinite(price) ? price * 0.3 : 0;
      const payout = Number.isFinite(price) ? price - commission : 0;

      return {
        anfrage_id: anfrageId,
        therapist,
        date,
        duration_min,
        price: Number.isFinite(price) ? price : 0,
        commission,
        payout,
      };
    }).filter(Boolean);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "NO_VALID_ROWS" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("sessions")
      .insert(rows)
      .select("id");

    if (error) {
      console.error("INSERT ERROR:", error);
      return NextResponse.json(
        { error: "DB_INSERT_FAILED", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, inserted: data?.length || 0 });
  } catch (err) {
    console.error("ADD SESSIONS SERVER ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
