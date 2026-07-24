export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@supabase/supabase-js";
import { teamData } from "../../lib/teamData";

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

function normalizePrice(value, fallback = null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const normalized =
    typeof value === "string"
      ? value.replace(",", ".").trim()
      : value;

  const number = Number(normalized);

  return Number.isFinite(number) ? number : fallback;
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
        email,
        profile_name,
        profile_role,
        profile_calendar_mode,
        profile_short,
        profile_keywords,
        profile_preis_std,
        profile_preis_ermaessigt,
        booking_window_days
      `);

    if (error) {
      console.error("PUBLIC TEAM MEMBERS ERROR:", error);
      return json({ error: error.message }, 500);
    }

    const dbMembers = members || [];

    const dbById = new Map(
      dbMembers
        .filter((member) => member.id != null)
        .map((member) => [String(member.id).trim(), member])
    );

    const dbByEmail = new Map(
      dbMembers
        .filter((member) => member.email)
        .map((member) => [normalize(member.email), member])
    );

    const dbByName = new Map(
      dbMembers
        .filter((member) => member.profile_name)
        .map((member) => [normalize(member.profile_name), member])
    );

    const merged = teamData.map((teamMember) => {
      const dbMember =
        dbById.get(String(teamMember.id || "").trim()) ||
        dbByEmail.get(normalize(teamMember.email)) ||
        dbByName.get(normalize(teamMember.name)) ||
        null;

      const preisStd = normalizePrice(
        dbMember?.profile_preis_std,
        teamMember.preis_std ?? null
      );

      const preisErmaessigt = normalizePrice(
        dbMember?.profile_preis_ermaessigt,
        teamMember.preis_ermaessigt ?? null
      );

      console.log("PUBLIC TEAM MEMBER MERGE", {
        teamDataName: teamMember.name,
        teamDataId: teamMember.id,
        teamDataEmail: teamMember.email,
        dbFound: !!dbMember,
        dbId: dbMember?.id,
        dbEmail: dbMember?.email,
        dbName: dbMember?.profile_name,
        dbPreisStd: dbMember?.profile_preis_std,
        dbPreisErmaessigt: dbMember?.profile_preis_ermaessigt,
        returnedPreisStd: preisStd,
        returnedPreisErmaessigt: preisErmaessigt,
      });

      return {
        ...teamMember,

        id: dbMember?.id ?? teamMember.id,
        email: dbMember?.email ?? teamMember.email,

        name:
          dbMember?.profile_name?.trim() ||
          teamMember.name,

        role:
          dbMember?.profile_role?.trim() ||
          teamMember.role,

        calendar_mode:
          dbMember?.profile_calendar_mode ||
          teamMember.calendar_mode ||
          "proposal",

        short:
          dbMember?.profile_short?.trim() ||
          teamMember.short,

        keywords:
          Array.isArray(dbMember?.profile_keywords)
            ? dbMember.profile_keywords
            : teamMember.keywords || [],

        tags:
          Array.isArray(dbMember?.profile_keywords)
            ? dbMember.profile_keywords
            : teamMember.tags || teamMember.keywords || [],

        preis_std: preisStd,

        preis_ermaessigt: preisErmaessigt,

        booking_window_days:
          dbMember?.booking_window_days ??
          teamMember.booking_window_days ??
          90,
      };
    });

    return json({ members: merged });
  } catch (err) {
    console.error("PUBLIC TEAM MEMBERS SERVER ERROR:", err);
    return json({ error: String(err) }, 500);
  }
}
