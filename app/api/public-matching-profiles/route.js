export const dynamic = "force-dynamic";

import {
  json,
  supabaseAdmin,
} from "../_lib/server";

export async function GET() {
  try {
    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from("team_members")
      .select("id, matching_scores");

    if (error) {
      return json({ error: "INTERNAL_ERROR" }, 400);
    }

    return json({
      ok: true,
      members: data || [],
    });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: "INTERNAL_ERROR" }, 500);
  }
}
