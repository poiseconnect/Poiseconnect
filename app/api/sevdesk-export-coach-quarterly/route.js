import { getUserFromBearer, json, supabaseAdmin } from "../_lib/server.js";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { user, error } = await getUserFromBearer(req);
  if (!user) return json({ error: error || "NO_TOKEN" }, 401);

  const supabase = supabaseAdmin();
  const { data: member, error: memberError } = await supabase
    .from("team_members")
    .select("id, role, active")
    .eq("user_id", user.id)
    .single();

  if (memberError || !member || member.active !== true || member.role !== "admin") {
    return json({ error: "NO_ACCESS" }, 403);
  }

  return json({ error: "saved_coach_invoice_required" }, 410);
}
