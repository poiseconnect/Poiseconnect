export const dynamic = "force-dynamic";

import { supabase } from "../../lib/supabase";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req) {
  try {
    const body = await req.json();

    console.log("ADD-SESSION BODY:", body);

    const {
      anfrageId,
      therapist,
      date,
      duration,
      price, // ✅ MUSS vom Frontend kommen
    } = body;

    if (!anfrageId || !therapist || !date || !duration || price == null) {
      return json({ error: "MISSING_FIELDS" }, 400);
    }

    const p = Number(price);
    if (isNaN(p)) {
      return json({ error: "INVALID_PRICE" }, 400);
    }

    const commission = p * 0.3;
    const payout = p * 0.7;

    const { error } = await supabase.from("sessions").insert({
      anfrage_id: anfrageId,
      therapist,
      date,
      duration_min: Number(duration),
      price: p,
      commission,
      payout,
    });

    if (error) {
      console.error("INSERT ERROR:", error);
      return json({ error: "session_failed", detail: error }, 500);
    }

    return json({ ok: true });

  } catch (err) {
    console.error("SERVER ERROR (add-session):", err);
    return json({ error: "server_error" }, 500);
  }
}
