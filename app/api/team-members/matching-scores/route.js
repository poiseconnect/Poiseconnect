export const dynamic = "force-dynamic";

import {
  json,
  supabaseAdmin,
  getUserFromBearer,
} from "../../_lib/server";

const ALLOWED_KEYS = [
  "partnerschaft_beziehung",
  "beruf_ziele_orientierung",
  "emotionales_essen",
  "depressive_verstimmung",
  "stress",
  "burnout",
  "selbstwert_selbstliebe",
  "angst_panik",
  "krankheit_psychosomatik",
  "angehoerige",
  "sexualitaet",
  "trauer",
];

function sanitizeScores(input) {
  const out = {};

  for (const key of ALLOWED_KEYS) {
    const raw = input?.[key];
    const n = Number(raw);

    out[key] = Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0;
  }

  return out;
}

export async function GET(req) {
  try {
    const { user, error } = await getUserFromBearer(req);
    if (!user) return json({ error }, 401);

    const sb = supabaseAdmin();

    const { data: member, error: memberErr } = await sb
      .from("team_members")
      .select("id, matching_scores, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberErr || !member) {
      return json({ error: "NO_TEAM_MEMBER" }, 403);
    }

    return json({
      ok: true,
      matching_scores: member.matching_scores || {},
    });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}

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

    if (memberErr || !member) {
      return json({ error: "NO_TEAM_MEMBER" }, 403);
    }

    if (!member.active) {
      return json({ error: "NOT_ALLOWED" }, 403);
    }

    const body = await req.json();
    const matching_scores = sanitizeScores(body?.matching_scores || {});

    const { data, error: updateErr } = await sb
      .from("team_members")
      .update({
        matching_scores,
      })
      .eq("id", member.id)
      .select("matching_scores")
      .single();

    if (updateErr) {
      return json({ error: updateErr.message }, 400);
    }

    return json({
      ok: true,
      matching_scores: data.matching_scores || {},
    });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
