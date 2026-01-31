export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

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

    if (!anfrageId || !therapist || !Array.isArray(sessions)) {
      return json({ error: "INVALID_INPUT" }, 400);
    }

    const clean = sessions
      .filter((s) => s?.date)
      .map((s) => ({
        anfrage_id: anfrageId,
        therapist,
        date: new Date(s.date).toISOString(),
        duration_min: Number(s.duration) || 60,
        price: Number(s.price) || 0,
      }));

    if (!clean.length) {
      return json({ error: "NO_VALID_SESSIONS" }, 400);
    }

    const { error } = await supabase
      .from("sessions")
      .insert(clean);

    if (error) {
      console.error("❌ ADD SESSIONS ERROR:", error);
      return json(
        { error: "DB_INSERT_FAILED", detail: error.message },
        500
      );
    }

    return json({ ok: true });
  } catch (err) {
    console.error("🔥 ADD SESSIONS SERVER ERROR:", err);
    return json(
      { error: "SERVER_ERROR", detail: String(err) },
      500
    );
  }
}
