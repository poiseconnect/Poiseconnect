export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { teamData } from "@/app/lib/teamData";

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

export async function GET() {
  try {
    const { data: members, error } = await supabase
      .from("team_members")
      .select(`
        id,
        email,
        profile_name,
        profile_role,
        profile_calendar_mode,
        profile_short,
        profile_keywords,
        profile_preis_std,
        profile_preis_ermaessigt
      `);

    if (error) {
      console.error("PUBLIC TEAM MEMBERS ERROR:", error);
      return json({ error: error.message }, 500);
    }

    const dbById = new Map((members || []).map((m) => [String(m.id), m]));
    const dbByEmail = new Map((members || []).map((m) => [String(m.email), m]));

    const merged = teamData.map((t) => {
      const db =
        dbById.get(String(t.id)) ||
        dbByEmail.get(String(t.email)) ||
        null;

      return {
        ...t,
        name: db?.profile_name || t.name,
        role: db?.profile_role || t.role,
        calendar_mode: db?.profile_calendar_mode || t.calendar_mode,
        short: db?.profile_short || t.short,
        keywords:
          Array.isArray(db?.profile_keywords) && db.profile_keywords.length
            ? db.profile_keywords
            : t.keywords || [],
        preis_std:
          db?.profile_preis_std != null ? db.profile_preis_std : t.preis_std,
        preis_ermaessigt:
          db?.profile_preis_ermaessigt != null
            ? db.profile_preis_ermaessigt
            : t.preis_ermaessigt,
      };
    });

    return json({ members: merged });
  } catch (err) {
    console.error("PUBLIC TEAM MEMBERS SERVER ERROR:", err);
    return json({ error: String(err) }, 500);
  }
}
