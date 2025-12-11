export const dynamic = "force-dynamic";

import { supabase } from "../../lib/supabase";

export async function POST(request) {
  try {
    const body = await request.text();
    const data = JSON.parse(body);

    console.log("ADD-SESSION BODY:", data);

    const {
      anfrageId,
      therapist,
      date,
      duration,
      price
    } = data;

    if (
      !anfrageId ||
      !therapist ||
      !date ||
      !duration ||
      price === undefined
    ) {
      return new Response(
        JSON.stringify({ error: "MISSING_FIELDS" }),
        { status: 400 }
      );
    }

    const p = Number(price);
    if (isNaN(p)) {
      return new Response(
        JSON.stringify({ error: "INVALID_PRICE" }),
        { status: 400 }
      );
    }

    const commission = p * 0.3;
    const payout = p * 0.7;

    const { error } = await supabase
      .from("sessions")
      .insert({
        anfrage_id: anfrageId,
        therapist,
        date,
        duration_min: Number(duration),
        price: p,
        commission,
        payout
      });

    if (error) {
      console.error("INSERT ERROR:", error);
      return new Response(
        JSON.stringify({ error: "session_failed", detail: error }),
        { status: 500 }
      );
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });

  } catch (err) {
    console.error("SERVER ERROR (add-session):", err);
    return new Response(
      JSON.stringify({ error: "server_error", detail: String(err) }),
      { status: 500 }
    );
  }
}
