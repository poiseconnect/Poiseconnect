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
    const { requestId } = await req.json();

    if (!requestId) {
      return json({ error: "missing_requestId" }, 400);
    }

    const { data, error } = await supabase
      .from("appointment_proposals")
      .select("id, date")
      .eq("anfrage_id", requestId)
      .order("date", { ascending: true });

    if (error) return json({ error: error.message }, 500);

    return json(data || []);
  } catch (e) {
    console.error("PROPOSALS LIST ERROR:", e);
    return json({ error: "server_error" }, 500);
  }
}
