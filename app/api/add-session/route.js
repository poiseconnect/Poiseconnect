export const dynamic = "force-dynamic";

import { supabase } from "../../lib/supabase";

export async function POST(request) {
  try {
    const { anfrageId, therapist, date, duration, price } = await request.json();

    if (!anfrageId || !therapist || !date || !duration) {
      return new Response(JSON.stringify({ error: "MISSING_FIELDS" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ✅ Preisquelle: Wenn price nicht mitkommt -> letzten price aus sessions nehmen
    let finalPrice = price;

    if (finalPrice == null) {
      const { data: lastSession, error: lastErr } = await supabase
        .from("sessions")
        .select("price")
        .eq("anfrage_id", anfrageId)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastErr) {
        console.error("LOAD LAST SESSION ERROR:", lastErr);
        return new Response(JSON.stringify({ error: "LOAD_LAST_SESSION_FAILED" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!lastSession?.price && lastSession?.price !== 0) {
        // Es gibt noch keine Session => dann MUSS price vom Client kommen
        return new Response(JSON.stringify({ error: "PRICE_REQUIRED_FIRST_SESSION" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      finalPrice = lastSession.price;
    }

    const p = Number(finalPrice);
    if (Number.isNaN(p)) {
      return new Response(JSON.stringify({ error: "INVALID_PRICE" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const commission = p * 0.3;
    const payout = p * 0.7;

    const { error: insertErr } = await supabase.from("sessions").insert({
      anfrage_id: anfrageId,
      therapist,
      date,
      duration_min: Number(duration),
      price: p,
      commission,
      payout,
    });

    if (insertErr) {
      console.error("INSERT ERROR:", insertErr);
      return new Response(JSON.stringify({ error: "SESSION_INSERT_FAILED", detail: insertErr }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("SERVER ERROR (add-session):", err);
    return new Response(JSON.stringify({ error: "SERVER_ERROR", detail: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
