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
    const { requestId, therapist_id, proposals } = body || {};

    if (!requestId || !therapist_id || !Array.isArray(proposals)) {
      return json({ error: "missing_data" }, 400);
    }

    // nur gültige Dates übernehmen
    const rows = proposals
      .map((p) => ({ date: p?.date }))
      .filter((p) => typeof p.date === "string" && p.date.trim().length > 0)
      .map((p) => ({
        anfrage_id: requestId,
        therapist_id,
        date: p.date, // <- ohne status
      }));

    if (!rows.length) {
      return json({ error: "no_valid_proposals" }, 400);
    }

    // Optional: alte Vorschläge dieses Requests löschen (damit es sauber bleibt)
    await supabase
      .from("appointment_proposals")
      .delete()
      .eq("anfrage_id", requestId);

    const { data, error } = await supabase
      .from("appointment_proposals")
      .insert(rows)
      .select("id, date");

    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, data });
  } catch (e) {
    console.error("PROPOSALS CREATE ERROR:", e);
    return json({ error: "server_error" }, 500);
  }
}
