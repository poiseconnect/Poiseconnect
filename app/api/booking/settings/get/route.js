export const dynamic = "force-dynamic";

import {
  json,
  supabaseAdmin,
  getUserFromBearer,
} from "../../../_lib/server";

export async function GET(req) {
  try {
    const { user, error } = await getUserFromBearer(req);
    if (!user) return json({ error }, 401);

    const sb = supabaseAdmin();

    const { data: member, error: memberErr } = await sb
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberErr || !member) return json({ error: "NO_TEAM_MEMBER" }, 403);

    const { data } = await sb
      .from("therapist_booking_settings")
      .select("*")
      .eq("therapist_id", member.id)
      .single();

return json({
  settings: data
    ? {
        ...data,
        booking_window_days: Number(data.booking_window_days || 90),
      }
    : null,
});
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
