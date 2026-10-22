export const dynamic = "force-dynamic";

import {
  canAccessAssignedRequest,
  getActiveTeamMember,
  json,
} from "../_lib/server";

export async function POST(req) {
  try {
    const auth = await getActiveTeamMember(req);
    if (!auth.member) return json({ error: auth.error }, auth.status);
    if (!["admin", "therapist"].includes(auth.member.role)) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const body = await req.json();

    const anfrageId = body?.anfrageId;
    const meetingLink = body?.meeting_link_override;

    if (!anfrageId) {
      return json({ error: "MISSING_ANFRAGE_ID" }, 400);
    }
    if (meetingLink !== null && meetingLink !== undefined && typeof meetingLink !== "string") {
      return json({ error: "INVALID_MEETING_LINK" }, 400);
    }

    const { data: requestRow, error: loadError } = await auth.supabase
      .from("anfragen")
      .select("id, assigned_therapist_id")
      .eq("id", anfrageId)
      .maybeSingle();
    if (loadError) return json({ error: "REQUEST_LOAD_FAILED" }, 500);
    if (!requestRow) return json({ error: "REQUEST_NOT_FOUND" }, 404);
    if (!canAccessAssignedRequest(auth.member, requestRow.assigned_therapist_id)) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    let update = auth.supabase
      .from("anfragen")
      .update({
        meeting_link_override: meetingLink?.trim() || null,
      })
      .eq("id", anfrageId);
    if (auth.member.role === "therapist") {
      update = update.eq("assigned_therapist_id", auth.member.id);
    }
    const { data: updated, error } = await update.select("id").maybeSingle();

    if (error) return json({ error: "UPDATE_FAILED" }, 500);
    if (!updated) return json({ error: "REQUEST_ASSIGNMENT_CHANGED" }, 409);

    return json({ ok: true });
  } catch {
    return json({ error: "SERVER_ERROR", detail: "INTERNAL_ERROR" }, 500);
  }
}
