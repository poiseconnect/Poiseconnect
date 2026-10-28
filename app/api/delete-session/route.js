import {
  json,
  getUserFromBearer,
  supabaseAdmin,
} from "../_lib/server";
import { billingMutationError, billingOwnerIds, ownsBillingRow } from "../_lib/billingAccess";

export async function POST(req) {
  const { user, error: authError } = await getUserFromBearer(req);
  if (!user) {
    return json({ error: authError || "NO_TOKEN" }, 401);
  }

  const sb = supabaseAdmin();

  const { data: member, error: memberErr } = await sb
    .from("team_members")
    .select("id, user_id, role, active")
    .eq("user_id", user.id)
    .single();

  if (memberErr || !member || member.active !== true) {
    return json({ error: "NO_ACCESS" }, 403);
  }

  const isAdmin = member.role === "admin";
  const isTherapist = member.role === "therapist";

  if (!isAdmin && !isTherapist) {
    return json({ error: "NO_ACCESS" }, 403);
  }

  const { sessionId } = await req.json();

  if (!sessionId) {
    return json({ error: "sessionId fehlt" }, 400);
  }

  const { data: existingSession, error: sessionErr } = await sb
    .from("sessions")
    .select("id, therapist_id, anfrage_id")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !existingSession) {
    return json({ error: "SESSION_NOT_FOUND" }, 404);
  }

  if (
    isTherapist &&
    !ownsBillingRow(existingSession, billingOwnerIds(member, user))
  ) {
    return json({ error: "NO_ACCESS" }, 403);
  }

  if (isTherapist) {
    if (!existingSession.anfrage_id) return json({ error: "NO_ACCESS" }, 403);
    const { data: assignment, error: assignmentError } = await sb
      .from("anfragen").select("id, assigned_therapist_id")
      .eq("id", existingSession.anfrage_id).single();
    if (assignmentError || !assignment ||
        !billingOwnerIds(member, user).includes(String(assignment.assigned_therapist_id || ""))) {
      return json({ error: "HISTORICAL_SESSION_READ_ONLY" }, 403);
    }
  }

  try {
    const { data, error } = await sb.rpc("privacy_delete_care_session", {
      p_actor_id: user.id,
      p_session_id: sessionId,
    });
    if (error) {
      const failure = billingMutationError(error);
      return json({ error: failure.error }, failure.status);
    }
    if (!data || data.success !== true) {
      return json({ error: "BILLING_MUTATION_UNAVAILABLE" }, 503);
    }
    return json({ success: true });
  } catch {
    return json({ error: "BILLING_MUTATION_UNAVAILABLE" }, 503);
  }
}
