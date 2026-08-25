export const dynamic = "force-dynamic";
export const revalidate = 0;

import { supabaseAdmin, json } from "../_lib/server";
import { toFormTeamMember } from "../../lib/formTeamMembers";

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("team_members")
      .select(`
        id,
        profile_name,
        profile_role,
        profile_calendar_mode,
        profile_short,
        profile_keywords,
        profile_preis_std,
        profile_preis_ermaessigt,
        paarcoaching,
        paarcoaching_preis,
        paarcoaching_dauer_min,
        proposal_earliest_time,
        proposal_latest_time
      `);

    if (error) {
      return json({ error: "TEAM_MEMBERS_LOAD_FAILED" }, 500);
    }

    return json({
      members: (data || []).map((member) => toFormTeamMember(member)),
    });
  } catch (error) {
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
