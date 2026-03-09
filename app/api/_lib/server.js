import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Stabil: User aus Bearer Token (wie bei billing-sessions)
export async function getUserFromBearer(req) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return { user: null, error: "NO_TOKEN" };

  const token = authHeader.replace("Bearer ", "");

  const supabaseAnon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data?.user) return { user: null, error: "INVALID_USER" };

  return { user: data.user, error: null };
}

export function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
