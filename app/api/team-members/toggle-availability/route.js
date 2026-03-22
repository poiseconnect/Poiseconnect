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
    const { teamMemberId, available } = body || {};

    if (!teamMemberId || typeof available !== "boolean") {
      return json({ error: "missing_fields" }, 400);
    }

    const { error } = await supabase
      .from("team_members")
      .update({
        available_for_intake: available,
      })
      .eq("id", teamMemberId);

    if (error) {
      console.error("TOGGLE AVAILABILITY ERROR:", error);
      return json({ error: error.message }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("TOGGLE AVAILABILITY SERVER ERROR:", err);
    return json(
      { error: "server_error", detail: String(err) },
      500
    );
  }
}
