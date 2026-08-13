export const dynamic = "force-dynamic";

import {
  getUserFromBearer,
  json,
  supabaseAdmin,
} from "../_lib/server";

export async function POST(req) {
  try {
    const { user, error: authError } = await getUserFromBearer(req);
    if (!user) return json({ error: authError || "NO_TOKEN" }, 401);

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

    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }

    const { anfrageId, tarif } = body || {};

    if (!anfrageId || tarif === undefined) {
      return json({ error: "MISSING_FIELDS" }, 400);
    }

    const value = Number(tarif);
    if (!Number.isFinite(value)) {
      return json({ error: "INVALID_TARIF" }, 400);
    }

    const { data: anfrage, error: anfrageErr } = await sb
      .from("anfragen")
      .select("id, assigned_therapist_id")
      .eq("id", anfrageId)
      .single();

    if (anfrageErr || !anfrage) {
      return json({ error: "REQUEST_NOT_FOUND" }, 404);
    }

    if (
      isTherapist &&
      String(anfrage.assigned_therapist_id) !== String(member.id)
    ) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const { error } = await sb
      .from("anfragen")
      .update({ honorar_klient: value })
      .eq("id", anfrageId);

    if (error) {
      return json({ error: "DB_UPDATE_FAILED" }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
