export const dynamic = "force-dynamic";

// Rein lesende Admin-Übersicht: Themengewichtungen (matching_scores) und
// Intake-Verfügbarkeit aller Coaches. Keine Schreibzugriffe.

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

    const { data: members, error: membersErr } = await sb
      .from("team_members")
      .select(
        "id, name, profile_name, role, active, available_for_intake, matching_scores"
      )
      .eq("role", "therapist");

    if (membersErr) {
      return json({ error: "MEMBERS_LOAD_FAILED", detail: "INTERNAL_ERROR" }, 500);
    }

    return json({ ok: true, members: members || [] });
  } catch {
    return json({ error: "SERVER_ERROR", detail: "INTERNAL_ERROR" }, 500);
  }
}
