export const dynamic = "force-dynamic";

import {
  getUserFromBearer,
  json,
  supabaseAdmin,
} from "../_lib/server";

export async function POST(req) {
  try {
    const { user, error: authError } = await getUserFromBearer(req);
    if (!user) return json({ error: authError || "NO_TOKEN" }, 401);

    const sb = supabaseAdmin();

    const { data: member, error: memberErr } = await sb
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberErr || !member || member.active !== true) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const isAdmin = member.role === "admin";
    const isTherapist = member.role === "therapist";

    if (!isAdmin && !isTherapist) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }

    const { therapist_id, ...settings } = body;

    if (!therapist_id) {
      return json({ error: "THERAPIST_ID_MISSING" }, 400);
    }

    if (isTherapist && String(therapist_id) !== String(member.id)) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const { data: targetMember, error: targetMemberErr } = await sb
      .from("team_members")
      .select("id")
      .eq("id", therapist_id)
      .single();

    if (targetMemberErr || !targetMember) {
      return json({ error: "THERAPIST_NOT_FOUND" }, 404);
    }

    const { error } = await sb
      .from("therapist_invoice_settings")
      .upsert(
        {
          therapist_id,
          ...settings,
        },
        { onConflict: "therapist_id" }
      );

    if (error) {
      return json({ error: "SAVE_FAILED" }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
