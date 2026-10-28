export const dynamic = "force-dynamic";

import {
  getUserFromBearer,
  json,
  supabaseAdmin,
} from "../_lib/server";
import { transferRequestCare } from "../../lib/intakeAccess.js";

export async function POST(request) {
  try {
    const { user, error: authError } = await getUserFromBearer(request);
    if (!user) return json({ error: authError || "NO_TOKEN" }, 401);

    const sb = supabaseAdmin();

    const { data: member, error: memberErr } = await sb
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberErr || !member || member.active !== true) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    if (member.role !== "admin" && member.role !== "therapist") {
      return json({ error: "NO_ACCESS" }, 403);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }

    const { anfrageId, handoverType } = body || {};
    if (!anfrageId) return json({ error: "MISSING_ANFRAGE_ID" }, 400);

    if (!['not_match', 'therapist_change'].includes(handoverType)) {
      return json({ error: "INVALID_HANDOVER_TYPE" }, 400);
    }

    const result = await transferRequestCare(sb, {
      requestId: anfrageId,
      actorId: member.id,
      handoverType,
      targetCoachId: body.targetCoachId || null,
      expectedVersion: body.expectedCareVersion,
      operationId: body.operationId,
    });
    return json(result.data || { error: result.error }, result.status);
  } catch {
    console.error("COACH_HANDOVER_UNAVAILABLE");
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
