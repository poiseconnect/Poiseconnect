export const dynamic = "force-dynamic";

import {
  json,
  oauthClient,
  supabaseAdmin,
  getUserFromBearer,
} from "../../_lib/server";
import { createGoogleOAuthState } from "../../_lib/googleOAuthState";

export async function GET(req) {
  try {
    const { user, error } = await getUserFromBearer(req);
    if (!user) return json({ error }, 401);

    const sb = supabaseAdmin();

    const { data: member, error: memberErr } = await sb
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberErr || !member) return json({ error: "NO_TEAM_MEMBER" }, 403);
    if (member.role !== "therapist" || !member.active) {
      return json({ error: "NOT_ALLOWED" }, 403);
    }
    if (!process.env.GOOGLE_CLIENT_SECRET) {
      return json({ error: "OAUTH_NOT_CONFIGURED" }, 500);
    }

    const flowState = createGoogleOAuthState(member.id, process.env.GOOGLE_CLIENT_SECRET);
    const oauth = oauthClient();

    const url = oauth.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/calendar",
      ],
      state: flowState.state,
    });

    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return new Response(JSON.stringify({ url }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Set-Cookie": `google_oauth_state=${flowState.cookieValue}; Path=/api/google/callback; HttpOnly; SameSite=Lax; Max-Age=${flowState.maxAge}${secure}`,
      },
    });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: "INTERNAL_ERROR" }, 500);
  }
}
