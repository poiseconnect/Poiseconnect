export const dynamic = "force-dynamic";

import { json, oauthClient, supabaseAdmin, getUserFromBearer } from "../../_lib/server";

export async function GET(req) {
  try {
    const { user, error } = await getUserFromBearer(req);
    if (!user) return json({ error }, 401);

    const sb = supabaseAdmin();

    // team_member finden (therapist)
    const { data: member, error: mErr } = await sb
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (mErr || !member) return json({ error: "NO_TEAM_MEMBER" }, 403);
    if (member.role !== "therapist" || !member.active) return json({ error: "NOT_ALLOWED" }, 403);

    const oauth = oauthClient();

    const url = oauth.generateAuthUrl({
      access_type: "offline",
      prompt: "consent", // wichtig fürs refresh_token
      scope: [
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events",
      ],
      state: member.id, // therapist_id
    });

    return json({ url });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
