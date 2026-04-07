export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

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

async function getUserFromBearer(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.error("GET USER FROM TOKEN ERROR:", error);
    return null;
  }

  return user;
}

export async function GET(req) {
  try {
    const user = await getUserFromBearer(req);

    if (!user) {
      return json({ error: "unauthorized" }, 401);
    }

    const { data: member, error } = await supabase
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
      `)
      .eq("email", user.email)
      .single();

    if (error) {
      console.error("PROFILE GET ERROR:", error);
      return json({ error: "load_failed", detail: error.message }, 500);
    }

    return json({ member });
  } catch (err) {
    console.error("PROFILE GET SERVER ERROR:", err);
    return json({ error: "server_error", detail: String(err) }, 500);
  }
}

export async function POST(req) {
  try {
    const user = await getUserFromBearer(req);

    if (!user) {
      return json({ error: "unauthorized" }, 401);
    }

    const body = await req.json();

    const payload = {
      profile_name: body.profile_name || null,
      profile_role: body.profile_role || null,
      profile_calendar_mode: body.profile_calendar_mode || null,
      profile_short: body.profile_short || null,
      profile_keywords: Array.isArray(body.profile_keywords)
        ? body.profile_keywords
        : null,
      profile_preis_std:
        body.profile_preis_std === null || body.profile_preis_std === ""
          ? null
          : Number(body.profile_preis_std),
      profile_preis_ermaessigt:
        body.profile_preis_ermaessigt === null ||
        body.profile_preis_ermaessigt === ""
          ? null
          : Number(body.profile_preis_ermaessigt),
    };

    const { data: member, error } = await supabase
      .from("team_members")
      .update(payload)
      .eq("email", user.email)
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
      `)
      .single();

    if (error) {
      console.error("PROFILE SAVE ERROR:", error);
      return json({ error: "save_failed", detail: error.message }, 500);
    }

    return json({ ok: true, member });
  } catch (err) {
    console.error("PROFILE POST SERVER ERROR:", err);
    return json({ error: "server_error", detail: String(err) }, 500);
  }
}
