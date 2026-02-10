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
    const { requestId, therapist_id, proposals } = body;

    if (!requestId || !therapist_id || !proposals?.length) {
      return json({ error: "INVALID_INPUT" }, 400);
    }

    const rows = proposals.map((d) => ({
      anfrage_id: requestId,
      therapist_id,
      date: new Date(d).toISOString(),
    }));

    const { error } = await supabase
      .from("appointment_proposals")
      .insert(rows);

    if (error) {
      console.error(error);
      return json({ error: error.message }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
