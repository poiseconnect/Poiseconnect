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

    const { anfrageId, therapist, date, duration } = body;

    if (!anfrageId || !therapist || !date || !duration) {
      return json({ error: "MISSING_FIELDS" }, 400);
    }

    // ✅ Preis aus letzter Session holen
    const { data: lastSession, error: loadError } = await supabase
      .from("sessions")
      .select("price")
      .eq("anfrage_id", anfrageId)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (loadError || !lastSession) {
      console.error("HONORAR NOT FOUND:", loadError);
      return json({ error: "PRICE_NOT_FOUND" }, 500);
    }

    const price = Number(lastSession.price);
    const commission = price * 0.3;
    const payout = price * 0.7;

    const { error } = await supabase.from("sessions").insert({
      anfrage_id: anfrageId,
      therapist,
      date,
      duration_min: Number(duration),
      price,
      commission,
      payout,
    });

    if (error) {
      console.error("INSERT ERROR:", error);
      return json({ error: "session_failed", detail: error }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("SERVER ERROR (add-session):", e);
    return json({ error: "server_error", detail: String(e) }, 500);
  }
}
