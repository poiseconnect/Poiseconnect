export const dynamic = "force-dynamic";

import { oauthClient, supabaseAdmin } from "../../_lib/server";

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // therapist_id
  const error = url.searchParams.get("error");

  if (error) return new Response("Google OAuth error: " + error, { status: 400 });
  if (!code || !state) return new Response("Missing code/state", { status: 400 });

  const oauth = oauthClient();
  const sb = supabaseAdmin();

  const { tokens } = await oauth.getToken(code);

  await sb.from("therapist_google_tokens").upsert(
    {
      therapist_id: state,
      access_token: tokens.access_token || null,
      refresh_token: tokens.refresh_token || null,
      expiry_date: tokens.expiry_date || null,
      scope: tokens.scope || null,
      token_type: tokens.token_type || null,
      id_token: tokens.id_token || null,
      calendar_id: "primary",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "therapist_id" }
  );

  // Redirect zurück ins Dashboard
  return new Response(null, {
    status: 302,
    headers: { Location: "/dashboard?google=connected" },
  });
}
