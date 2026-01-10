export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

/**
 * ⚠️ WICHTIG:
 * In app/api darf KEIN Client-Supabase verwendet werden.
 */
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

export async function POST(request) {
  try {
    const body = await request.json();
    const { vorname, nachname, wunschtherapeut } = body || {};

    if (!vorname || !nachname || !wunschtherapeut) {
      return json({ error: "MISSING_FIELDS" }, 400);
    }

    const { error } = await supabase.from("anfragen").insert({
      vorname,
      nachname,
      wunschtherapeut,
      status: "active",
      quelle: "bestand",
    });

    if (error) {
      console.error("CREATE BESTAND DB ERROR:", error);
      return json(
        { error: "DB_ERROR", detail: error.message },
        500
      );
    }

    return json({ ok: true });
  } catch (err) {
    console.error("CREATE BESTAND SERVER ERROR:", err);
    return json(
      { error: "SERVER_ERROR", detail: String(err) },
      500
    );
  }
}
