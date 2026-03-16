export const dynamic = "force-dynamic";

import {
  json,
  supabaseAdmin,
  getUserFromBearer,
} from "../../_lib/server";

export async function GET(req) {
  try {
    const { user, error } = await getUserFromBearer(req);
    if (!user) return json({ error }, 401);

    const sb = supabaseAdmin();

    const { data: adminMember, error: adminErr } = await sb
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (adminErr || !adminMember) return json({ error: "NO_TEAM_MEMBER" }, 403);
    if (adminMember.role !== "admin" || !adminMember.active) {
      return json({ error: "NOT_ALLOWED" }, 403);
    }

    const { data: therapists } = await sb
      .from("team_members")
      .select("id, name, email, role, active")
      .eq("role", "therapist")
      .eq("active", true);

    const rows = [];

    for (const t of therapists || []) {
      const { data: settings } = await sb
        .from("therapist_booking_settings")
        .select("*")
        .eq("therapist_id", t.id)
        .single();

      const { data: tokens } = await sb
        .from("therapist_google_tokens")
        .select("therapist_id")
        .eq("therapist_id", t.id)
        .single();

      rows.push({
        therapist_id: t.id,
        name: t.name,
        email: t.email,
        google_connected: !!tokens,
        booking_enabled: !!settings?.booking_enabled,
        selected_calendar_name: settings?.selected_calendar_name || null,
        selected_calendar_id: settings?.selected_calendar_id || null,
      });
    }

    return json({ rows });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
