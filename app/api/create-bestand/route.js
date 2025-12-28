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
    const { vorname, nachname, wunschtherapeut } = await req.json();

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
      console.error("CREATE BESTAND ERROR:", error);
      return json({ error: "DB_ERROR", detail: error.message }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
