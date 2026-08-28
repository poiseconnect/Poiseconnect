export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";
import { teamData } from "../../lib/teamData";
import { toPublicCoachMember } from "../../lib/publicCoachDirectory";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET() {
  try {
    const { data: members, error } = await supabase
  .from("team_members")
  .select(`
    id,
    active,
    available_for_intake,
    profile_name,
    profile_role,
    profile_short,
    matching_scores
  `)
  .eq("active", true)
  .eq("available_for_intake", true);
    
    if (error) {
      console.error("PUBLIC TEAM MEMBERS ERROR:", { code: error?.code || null });
      return json({ error: "INTERNAL_ERROR" }, 500);
    }

    const dbMembers = members || [];

    const dbById = new Map(
      dbMembers
        .filter((member) => member.id != null)
        .map((member) => [String(member.id).trim(), member])
    );

    const dbByName = new Map(
      dbMembers
        .filter((member) => member.profile_name)
        .map((member) => [normalize(member.profile_name), member])
    );

    const merged = teamData.map((teamMember) => {
      const dbMember =
        dbById.get(String(teamMember.id || "").trim()) ||
        dbByName.get(normalize(teamMember.name)) ||
        null;

      return toPublicCoachMember(teamMember, dbMember);
    }).filter(Boolean);

    return json({ members: merged });
  } catch (err) {
    console.error("PUBLIC TEAM MEMBERS SERVER ERROR");
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
}
