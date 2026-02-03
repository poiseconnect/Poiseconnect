export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// -----------------------------------------
// 🔧 Supabase SERVER Client
// -----------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// -----------------------------------------
// 🚀 POST: EINZELNE SITZUNG
// -----------------------------------------
export async function POST(req) {
  try {
    const body = await req.json();

    console.log("ADD-SESSION BODY:", body);

    const {
      anfrageId,
      therapist,        // Anzeigename (optional)
      therapist_id,     // 🔥 UUID (ENTSCHEIDEND)
      date,
      duration,
      price,
    } = body || {};

    if (
      !anfrageId ||
      !therapist_id || // 🔥 FIX
      !date ||
      !duration ||
      price == null
    ) {
      return NextResponse.json(
        { error: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    const p = Number(price);
    if (isNaN(p)) {
      return NextResponse.json(
        { error: "INVALID_PRICE" },
        { status: 400 }
      );
    }

    // Datum absichern
    const safeDate =
      date && !isNaN(Date.parse(date))
        ? date
        : null;

    if (!safeDate) {
      return NextResponse.json(
        { error: "INVALID_DATE" },
        { status: 400 }
      );
    }

    const commission = p * 0.3;
    const payout = p * 0.7;

    // ✅ Sitzung speichern (UUID + Name)
    const { error } = await supabase
      .from("sessions")
      .insert({
        anfrage_id: anfrageId,
        therapist: therapist || null,   // legacy / Anzeige
        therapist_id,                  // 🔥 FIX
        date: safeDate,
        duration_min: Number(duration),
        price: p,
        commission,
        payout,
      });

    if (error) {
      console.error("ADD SESSION INSERT ERROR:", error);
      return NextResponse.json(
        { error: "SESSION_FAILED", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("ADD SESSION SERVER ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
