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
    const { therapist_id, ...settings } = body;

    if (!therapist_id) {
      return json({ error: "THERAPIST_ID_MISSING" }, 400);
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase
      .from("therapist_invoice_settings")
      .upsert(
        {
          therapist_id,
          ...settings,
        },
        {
          onConflict: "therapist_id",
        }
      );

    if (error) {
      return json(
        { error: "SUPABASE_ERROR", detail: error.message },
        400
      );
    }

    return json({ ok: true });
  } catch (err) {
    return json(
      { error: "SERVER_ERROR", detail: String(err) },
      500
    );
  }
}
