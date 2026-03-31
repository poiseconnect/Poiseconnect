export const dynamic = "force-dynamic";

import { json, supabaseAdmin } from "../../_lib/server";

export async function POST(req) {
  try {
    const body = await req.json();

    const anfrageId = body.anfrageId;
    const meeting_link_override = body.meeting_link_override || null;

    if (!anfrageId) {
      return json({ error: "MISSING_ANFRAGE_ID" }, 400);
    }

    const sb = supabaseAdmin();

    const { data, error } = await sb
      .from("anfragen")
      .update({
        meeting_link_override,
      })
      .eq("id", anfrageId)
      .select()
      .single();

    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({ ok: true, data });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
