export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getUserFromSession() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

export async function GET() {
  try {
    const user = await getUserFromSession();

    if (!user) {
      return json({ error: "unauthorized" }, 401);
    }

    const { data: member, error } = await admin
      .from("team_members")
      .select(`
        id,
        email,
        role,
        profile_name,
        profile_role,
        profile_calendar_mode,
        profile_short,
        profile_keywords,
        profile_preis_std,
        profile_preis_ermaessigt
      `)
      .eq("email", user.email)
      .single();

    if (error) {
      return json({ error: "member_not_found", detail: error.message }, 404);
    }

    return json({ member });
  } catch (err) {
    console.error("PROFILE GET ERROR:", err);
    return json({ error: "server_error", detail: String(err) }, 500);
  }
}

export async function POST(req) {
  try {
    const user = await getUserFromSession();

    if (!user) {
      return json({ error: "unauthorized" }, 401);
    }

    const body = await req.json();

    const {
      profile_name,
      profile_role,
      profile_calendar_mode,
      profile_short,
      profile_keywords,
      profile_preis_std,
      profile_preis_ermaessigt,
    } = body || {};

    const allowedModes = ["booking", "proposal", "ics"];
    if (
      profile_calendar_mode &&
      !allowedModes.includes(String(profile_calendar_mode))
    ) {
      return json({ error: "invalid_calendar_mode" }, 400);
    }

    const cleanKeywords = Array.isArray(profile_keywords)
      ? profile_keywords
          .map((x) => String(x || "").trim())
          .filter(Boolean)
      : [];

    const { data, error } = await admin
      .from("team_members")
      .update({
        profile_name: profile_name || null,
        profile_role: profile_role || null,
        profile_calendar_mode: profile_calendar_mode || null,
        profile_short: profile_short || null,
        profile_keywords: cleanKeywords,
        profile_preis_std:
          profile_preis_std === "" || profile_preis_std == null
            ? null
            : Number(profile_preis_std),
        profile_preis_ermaessigt:
          profile_preis_ermaessigt === "" || profile_preis_ermaessigt == null
            ? null
            : Number(profile_preis_ermaessigt),
      })
      .eq("email", user.email)
      .select(`
        id,
        email,
        role,
        profile_name,
        profile_role,
        profile_calendar_mode,
        profile_short,
        profile_keywords,
        profile_preis_std,
        profile_preis_ermaessigt
      `)
      .single();

    if (error) {
      console.error("PROFILE SAVE ERROR:", error);
      return json({ error: "update_failed", detail: error.message }, 500);
    }

    return json({ ok: true, member: data });
  } catch (err) {
    console.error("PROFILE POST ERROR:", err);
    return json({ error: "server_error", detail: String(err) }, 500);
  }
}
