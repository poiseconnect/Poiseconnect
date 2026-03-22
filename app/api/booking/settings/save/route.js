
export const dynamic = "force-dynamic";

import {
  json,
  supabaseAdmin,
  getUserFromBearer,
} from "../../../_lib/server";

export async function POST(req) {
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

    if (member.role !== "therapist" || !member.active) {
      return json({ error: "NOT_ALLOWED" }, 403);
    }

    const body = await req.json();

    const payload = {
      therapist_id: member.id,
      booking_enabled: !!body.booking_enabled,
      slot_duration_min: Number(body.slot_duration_min || 60),
      buffer_min: Number(body.buffer_min || 10),
      time_zone: body.time_zone || "Europe/Vienna",
      min_booking_notice_hours: Number(body.min_booking_notice_hours || 24),
      selected_calendar_id: body.selected_calendar_id || null,
      selected_calendar_name: body.selected_calendar_name || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error: upErr } = await sb
      .from("therapist_booking_settings")
      .upsert(payload, { onConflict: "therapist_id" })
      .select()
      .single();

    if (upErr) return json({ error: upErr.message }, 400);

    return json({ ok: true, data });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
