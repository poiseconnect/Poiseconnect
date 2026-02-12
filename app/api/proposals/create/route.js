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
    console.log("📥 BODY:", body);

    const { requestId, therapist_id, proposals } = body;

    if (!requestId || !therapist_id || !proposals?.length) {
      return json({ error: "missing_data", body }, 400);
    }

    const rows = proposals.map((p) => ({
      anfrage_id: requestId,
      therapist_id,
      date: p.date,
      status: "open",
    }));

    console.log("📤 INSERT:", rows);

    const { error, data } = await supabase
.from("appointment_proposals")
      .insert(rows)
      .select();

    if (error) {
      console.error("❌ INSERT ERROR:", error);
      return json({ error: error.message, details: error }, 500);
    }

    console.log("✅ SUCCESS:", data);
    return json({ ok: true });
  } catch (e) {
    console.error("🔥 SERVER CRASH:", e);
    return json({ error: e.message }, 500);
  }
}
