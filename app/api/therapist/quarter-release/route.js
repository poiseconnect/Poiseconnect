import { getUserFromBearer, json, supabaseAdmin } from "../../_lib/server.js";
import { jsonValuesEqual } from "../../invoices/_lib/coachInvoice.js";
import {
  coachQuarterWorkflowUnavailableBody,
  getCoachQuarterWorkflowReadiness,
} from "../../../lib/coachQuarterWorkflowReadiness.js";

export const dynamic = "force-dynamic";

const COACH_QUARTER_RELEASE_PENDING_MESSAGE =
  "Die Quartalsfreigabe ist noch nicht verfügbar. Deine Sitzungen und die Abrechnungsübersicht bleiben unverändert nutzbar.";

export async function GET(req) {
  const authorization = await authorizeTherapist(req);
  if (authorization.response) return authorization.response;
  const period = readQuarter(new URL(req.url).searchParams);
  if (!period) return json({ error: "invalid_billing_quarter" }, 400);

  const readiness = await getCoachQuarterWorkflowReadiness(authorization.supabase);
  if (!readiness.ready) {
    return json({
      available: false,
      message: COACH_QUARTER_RELEASE_PENDING_MESSAGE,
      release: null,
      session_count: 0,
    });
  }

  const { data: release, error } = await authorization.supabase
    .from("coach_quarter_releases")
    .select("release_version, release_status, released_at, snapshot")
    .eq("coach_id", authorization.member.id)
    .eq("billing_year", period.year)
    .eq("billing_quarter", period.quarter)
    .maybeSingle();
  if (error) return json({ error: "coach_quarter_release_load_failed" }, 500);
  const { data: currentSnapshot, error: snapshotError } = await authorization.supabase.rpc(
    "coach_quarter_snapshot",
    {
      p_coach_id: authorization.member.id,
      p_billing_year: period.year,
      p_billing_quarter: period.quarter,
    }
  );
  if (snapshotError) return json({ error: "coach_quarter_snapshot_load_failed" }, 500);
  if (!release) {
    return json({
      available: true,
      release: null,
      session_count: currentSnapshot?.sessions?.length || 0,
    });
  }
  const isCurrent = release.release_status === "released" &&
    jsonValuesEqual(currentSnapshot, release.snapshot);
  return json({
    available: true,
    release: {
      release_version: release.release_version,
      release_status: isCurrent ? "released" : "stale",
      released_at: release.released_at,
    },
    session_count: currentSnapshot?.sessions?.length || 0,
  });
}

export async function POST(req) {
  const authorization = await authorizeTherapist(req);
  if (authorization.response) return authorization.response;
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_request_body" }, 400);
  }
  const period = readQuarter(new URLSearchParams({
    year: String(body?.year || ""),
    quarter: String(body?.quarter || ""),
  }));
  if (!period) return json({ error: "invalid_billing_quarter" }, 400);

  const readiness = await getCoachQuarterWorkflowReadiness(authorization.supabase);
  if (!readiness.ready) {
    return json({
      ...coachQuarterWorkflowUnavailableBody(readiness),
      message: COACH_QUARTER_RELEASE_PENDING_MESSAGE,
    }, 503);
  }

  const { data, error } = await authorization.supabase.rpc("release_coach_quarter", {
    p_coach_id: authorization.member.id,
    p_billing_year: period.year,
    p_billing_quarter: period.quarter,
    p_released_by: authorization.member.id,
  });
  if (error) {
    const noSessions = String(error.message || "").includes("quarter_has_no_sessions");
    return json(
      { error: noSessions ? "quarter_has_no_sessions" : "coach_quarter_release_failed" },
      noSessions ? 409 : 500
    );
  }
  const release = Array.isArray(data) ? data[0] : data;
  return json({
    ok: true,
    release: {
      release_version: release?.release_version || null,
      release_status: release?.release_status || null,
      released_at: release?.released_at || null,
    },
    session_count: release?.snapshot?.sessions?.length || 0,
  });
}

async function authorizeTherapist(req) {
  const { user, error: authError } = await getUserFromBearer(req);
  if (!user) return { response: json({ error: authError || "NO_TOKEN" }, 401) };
  const supabase = supabaseAdmin();
  const { data: member, error } = await supabase
    .from("team_members")
    .select("id, role, active")
    .eq("user_id", user.id)
    .single();
  if (error || !member || member.active !== true || member.role !== "therapist") {
    return { response: json({ error: "NO_ACCESS" }, 403) };
  }
  return { supabase, member };
}

function readQuarter(params) {
  const year = Number(params.get("year"));
  const quarter = Number(params.get("quarter"));
  if (!Number.isInteger(year) || year < 2000 || year > 9999 ||
    !Number.isInteger(quarter) || quarter < 1 || quarter > 4) return null;
  return { year, quarter };
}
