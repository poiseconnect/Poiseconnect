export const dynamic = "force-dynamic";

import { oauthClient, supabaseAdmin } from "../../_lib/server";
import { verifyGoogleOAuthState } from "../../_lib/googleOAuthState";

function clearStateCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `google_oauth_state=; Path=/api/google/callback; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function response(body, status) {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": clearStateCookie(),
    },
  });
}

function getStateCookie(req) {
  const cookieHeader = req.headers.get("cookie") || "";
  const stateCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("google_oauth_state="));
  return stateCookie?.slice("google_oauth_state=".length) || null;
}

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return response("Google OAuth error", 400);
  }

  if (!code || !state) {
    return response("Missing code/state", 400);
  }

  const verifiedState = verifyGoogleOAuthState(
    getStateCookie(req),
    state,
    process.env.GOOGLE_CLIENT_SECRET
  );
  if (!verifiedState) return response("Invalid or expired OAuth state", 400);

  try {
    const sb = supabaseAdmin();
    const { data: member, error: memberError } = await sb
      .from("team_members")
      .select("id, role, active")
      .eq("id", verifiedState.memberId)
      .maybeSingle();
    if (memberError) return response("Team member lookup failed", 500);
    if (!member || member.role !== "therapist" || member.active !== true) {
      return response("Team member is not eligible", 403);
    }

    const oauth = oauthClient();
    const { tokens } = await oauth.getToken(code);

    const { error: upErr } = await sb
      .from("therapist_google_tokens")
      .upsert(
        {
          therapist_id: member.id,
          access_token: tokens.access_token || null,
          refresh_token: tokens.refresh_token || null,
          expiry_date: tokens.expiry_date || null,
          scope: tokens.scope || null,
          token_type: tokens.token_type || null,
          id_token: tokens.id_token || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "therapist_id" }
      );

    if (upErr) return response("Token save failed", 500);

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/dashboard?google=connected",
        "Cache-Control": "no-store",
        "Set-Cookie": clearStateCookie(),
      },
    });
  } catch {
    return response("Google connection failed", 502);
  }
}
