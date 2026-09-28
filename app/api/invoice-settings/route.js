export const dynamic = "force-dynamic";

import { getUserFromBearer, json, supabaseAdmin } from "../_lib/server";

export async function POST(req) {
  try {
    const { user, error: authError } = await getUserFromBearer(req);
    if (!user) return json({ error: authError || "NO_TOKEN" }, 401);

    const body = await req.json();
    const therapistId = String(body?.therapist_id || "").trim();
    if (!therapistId) return json({ error: "THERAPIST_ID_REQUIRED" }, 400);

    const supabase = supabaseAdmin();
    const { data: member, error: memberError } = await supabase
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (
      memberError ||
      !member ||
      member.active !== true ||
      !["admin", "therapist"].includes(member.role)
    ) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    if (member.role === "therapist" && String(member.id) !== therapistId) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const { data: targetMember, error: targetError } = await supabase
      .from("team_members")
      .select("id")
      .eq("id", therapistId)
      .maybeSingle();

    if (targetError) return json({ error: "INTERNAL_ERROR" }, 500);
    if (!targetMember) return json({ error: "THERAPIST_NOT_FOUND" }, 404);

    const { data, error } = await supabase
      .from("therapist_invoice_settings")
      .select("*")
      .eq("therapist_id", therapistId)
      .maybeSingle();

    if (error) return json({ error: "INTERNAL_ERROR" }, 500);

    return json({ settings: data || {} }, 200);
  } catch {
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
