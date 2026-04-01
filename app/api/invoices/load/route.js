export const dynamic = "force-dynamic";

import {
  json,
  supabaseAdmin,
  getUserFromBearer,
} from "../../_lib/server";

export async function GET(req) {
  try {
    const { user, error } = await getUserFromBearer(req);
    if (!user) return json({ error }, 401);

    const url = new URL(req.url);
    const anfrageId = url.searchParams.get("id");

    if (!anfrageId) {
      return json({ error: "MISSING_ID" }, 400);
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

    let anfrageQuery = sb
      .from("anfragen")
      .select("*")
      .eq("id", anfrageId);

    if (member.role === "therapist") {
      anfrageQuery = anfrageQuery.eq("assigned_therapist_id", member.id);
    }

    const { data: anfrage, error: anfrageErr } = await anfrageQuery.single();

    if (anfrageErr || !anfrage) {
      return json({ error: "ANFRAGE_NOT_FOUND" }, 404);
    }

    const { data: sessions, error: sessErr } = await sb
      .from("sessions")
      .select("*")
      .eq("anfrage_id", anfrageId)
      .order("date", { ascending: true });

    if (sessErr) {
      return json({ error: sessErr.message }, 400);
    }
    const therapistId =
      anfrage.assigned_therapist_id ||
      sessions?.[0]?.therapist_id ||
      null;

    let settings = null;
    let coach = null;

    if (therapistId) {
      const { data: invSet } = await sb
        .from("therapist_invoice_settings")
        .select("*")
        .eq("therapist_id", therapistId)
        .single();

      settings = invSet || null;

      const { data: coachMember } = await sb
        .from("team_members")
        .select("id, name, email")
        .eq("id", therapistId)
        .single();

      coach = coachMember || null;
    }

    return json({
      anfrage,
      sessions: sessions || [],
      settings,
      coach,
    });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
