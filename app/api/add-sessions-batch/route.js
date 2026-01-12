import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req) {
  try {
    const body = await req.json();

    const { anfrageId, therapist, sessions } = body || {};

    if (!anfrageId || !therapist || !Array.isArray(sessions) || sessions.length === 0) {
      return json({ error: "MISSING_FIELDS" }, 400);
    }

    const rows = sessions
      .map((s) => {
        const date = s?.date;
        const duration = Number(s?.duration);
        const price = Number(s?.price);
        if (!date || Number.isNaN(duration) || Number.isNaN(price)) return null;

        const commission = price * 0.3;
        const payout = price * 0.7;

        return {
          anfrage_id: anfrageId,
          therapist,
          date,
          duration_min: duration,
          price,
          commission,
          payout,
        };
      })
      .filter(Boolean);

    if (!rows.length) return json({ error: "NO_VALID_SESSIONS" }, 400);

    const { data, error } = await supabase.from("sessions").insert(rows).select("id");

    if (error) {
      console.error("INSERT ERROR:", error);
      return json({ error: "INSERT_FAILED", detail: error }, 500);
    }

    return json({ ok: true, inserted: data?.length || 0 });
  } catch (err) {
    console.error("ADD SESSIONS SERVER ERROR:", err);
    return json({ error: "SERVER_ERROR", detail: String(err) }, 500);
  }
}
