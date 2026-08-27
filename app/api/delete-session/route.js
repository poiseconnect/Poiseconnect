import {
  json,
  getUserFromBearer,
  supabaseAdmin,
} from "../_lib/server";

export async function POST(req) {
  const { user, error: authError } = await getUserFromBearer(req);
  if (!user) {
    return json({ error: authError || "NO_TOKEN" }, 401);
  }

  const sb = supabaseAdmin();

  const { data: member, error: memberErr } = await sb
    .from("team_members")
    .select("id, role, active")
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
    .select("id, therapist_id")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !existingSession) {
    return json({ error: "SESSION_NOT_FOUND" }, 404);
  }

  if (
    isTherapist &&
    String(existingSession.therapist_id) !== String(member.id)
  ) {
    return json({ error: "NO_ACCESS" }, 403);
  }

  const { error } = await sb
    .from("sessions")
    .delete()
    .eq("id", sessionId);

  if (error) {
    console.error("DELETE SESSION ERROR");
    return json({ error: error.message }, 500);
  }

  return json({ success: true });
}
