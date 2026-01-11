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
    const { anfrageId } = body || {};

    if (!anfrageId) {
      return json({ error: "missing_anfrageId" }, 400);
    }

    // 🔒 Nur beenden, wenn Sitzungen existieren
    const { count, error: countError } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("anfrage_id", anfrageId);

    if (countError) {
      console.error("SESSION COUNT ERROR:", countError);
      return json({ error: "SESSION_CHECK_FAILED" }, 500);
    }

    if (!count || count === 0) {
      return json(
        { error: "BEENDET_NUR_ERLAUBT_WENN_SITZUNGEN_EXISTIEREN" },
        400
      );
    }

    // ✅ Status setzen
    const { error } = await supabase
      .from("anfragen")
      .update({ status: "beendet" })
      .eq("id", anfrageId);

    if (error) {
      console.error("FINISH UPDATE ERROR:", error);
      return json(
        { error: "update_failed", detail: error.message },
        500
      );
    }

    return json({ ok: true });
  } catch (err) {
    console.error("FINISH SERVER ERROR:", err);
    return json(
      { error: "server_error", detail: String(err) },
      500
    );
  }
}
