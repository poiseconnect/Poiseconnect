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
    console.error("GET USER FROM TOKEN ERROR:", { code: error?.code || null });
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
    profile_preis_ermaessigt,
    paarcoaching,
    paarcoaching_preis,
    paarcoaching_dauer_min,
    sevdesk_contact_id,
    proposal_earliest_time,
    proposal_latest_time
  `)
  .eq("user_id", user.id)
  .single();

    if (error) {
      console.error("PROFILE GET ERROR:", { code: error?.code || null });
      return json({ error: "load_failed", detail: "INTERNAL_ERROR" }, 500);
    }

    return json({ member });
  } catch {
    console.error("PROFILE GET SERVER ERROR");
    return json({ error: "server_error", detail: "INTERNAL_ERROR" }, 500);
  }
}

export async function POST(req) {
  try {
    const user = await getUserFromBearer(req);

    if (!user) {
      return json({ error: "unauthorized" }, 401);
    }

    const body = await req.json();

// Optionale Proposal-Zeitrahmen (Version 1, kein Booking-Ersatz).
// Nur speichern, wenn Format "HH:MM" (24h) gültig ist, sonst null.
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const sanitizeProposalTime = (value) =>
  typeof value === "string" && timePattern.test(value.trim())
    ? value.trim()
    : null;

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

  paarcoaching: body.paarcoaching === true,

  paarcoaching_preis:
    body.paarcoaching_preis === null ||
    body.paarcoaching_preis === ""
      ? null
      : Number(body.paarcoaching_preis),

  paarcoaching_dauer_min:
    body.paarcoaching_dauer_min === null ||
    body.paarcoaching_dauer_min === ""
      ? null
      : Number(body.paarcoaching_dauer_min),

  sevdesk_contact_id:
    body.sevdesk_contact_id === null || body.sevdesk_contact_id === ""
      ? null
      : String(body.sevdesk_contact_id).trim(),

  proposal_earliest_time: sanitizeProposalTime(body.proposal_earliest_time),
  proposal_latest_time: sanitizeProposalTime(body.proposal_latest_time),
};

    const { data: member, error } = await supabase
      .from("team_members")
      .update(payload)
.eq("user_id", user.id)
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
  paarcoaching,
  paarcoaching_preis,
  paarcoaching_dauer_min,
  sevdesk_contact_id,
  proposal_earliest_time,
  proposal_latest_time
`)
      .single();

    if (error) {
      console.error("PROFILE SAVE ERROR:", { code: error?.code || null });
      return json({ error: "save_failed", detail: "INTERNAL_ERROR" }, 500);
    }

    return json({ ok: true, member });
  } catch {
    console.error("PROFILE POST SERVER ERROR");
    return json({ error: "server_error", detail: "INTERNAL_ERROR" }, 500);
  }
}
