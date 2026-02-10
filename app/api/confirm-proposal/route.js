export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { requestId, date } = body || {};

    if (!requestId || !date) {
      return json({ error: "MISSING_FIELDS" }, 400);
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Termin speichern
    const { error } = await supabase
      .from("anfragen")
      .update({
        bevorzugte_zeit: date,
        status: "termin_bestaetigt",
      })
      .eq("id", requestId);

    if (error) {
      console.error(error);
      return json({ error: error.message }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
