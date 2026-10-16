import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function getUserFromBearer(req) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { user: null, error: "NO_TOKEN" };
  }

  const token = authHeader.replace("Bearer ", "");

  const supabaseAnon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabaseAnon.auth.getUser(token);

  if (error || !data?.user) {
    return { user: null, error: "INVALID_USER" };
  }

  return { user: data.user, error: null };
}

export async function getActiveTeamMember(req) {
  const { user, error } = await getUserFromBearer(req);
  if (!user) {
    return { user: null, member: null, supabase: null, error, status: 401 };
  }

  const supabase = supabaseAdmin();
  const { data: member, error: memberError } = await supabase
    .from("team_members")
    .select("id, user_id, email, role, active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError) {
    return {
      user,
      member: null,
      supabase,
      error: "TEAM_MEMBER_LOOKUP_FAILED",
      status: 500,
    };
  }

  if (!member || member.active !== true) {
    return {
      user,
      member: null,
      supabase,
      error: "NO_ACCESS",
      status: 403,
    };
  }

  return { user, member, supabase, error: null, status: 200 };
}

export function canAccessAssignedRequest(member, assignedTherapistId) {
  if (!member || member.active !== true) return false;
  if (member.role === "admin") return true;
  return (
    member.role === "therapist" &&
    String(assignedTherapistId || "") === String(member.id)
  );
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
