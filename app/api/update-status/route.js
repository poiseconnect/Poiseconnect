export const dynamic = "force-dynamic";

import {
  json,
  supabaseAdmin,
  getUserFromBearer,
} from "../../_lib/server";

export async function POST(req) {
  try {
    const { user, error } = await getUserFromBearer(req);
    if (!user) return json({ error }, 401);

    const body = await req.json();
    const requestId = body.requestId;
    const status = body.status;

    if (!requestId) {
      return json({ error: "MISSING_REQUEST_ID" }, 400);
    }

    if (!status) {
      return json({ error: "MISSING_STATUS" }, 400);
    }

    const sb = supabaseAdmin();

    // 1) eingeloggtes Teammitglied laden
    const { data: member, error: memberErr } = await sb
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberErr || !member || member.active !== true) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    // 2) Anfrage laden
    const { data: anfrage, error: reqErr } = await sb
      .from("anfragen")
      .select("id, assigned_therapist_id, status")
      .eq("id", requestId)
      .single();

    if (reqErr || !anfrage) {
      return json({ error: "REQUEST_NOT_FOUND" }, 404);
    }

    // 3) Ownership / Admin prüfen
    if (
      member.role !== "admin" &&
      String(anfrage.assigned_therapist_id || "") !== String(member.id)
    ) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    // 4) Optional: erlaubte Statuswerte einschränken
    const allowedStatuses = [
      "neu",
      "termin_neu",
      "termin_bestaetigt",
      "active",
      "admin_pruefen",
      "admin_weiterleiten",
      "papierkorb",
      "beendet",
      "kein_match",
    ];

    if (!allowedStatuses.includes(String(status))) {
      return json({ error: "INVALID_STATUS" }, 400);
    }

    // 5) Update
    const { data: updated, error: updateErr } = await sb
      .from("anfragen")
      .update({ status })
      .eq("id", requestId)
      .select("id, status")
      .single();

    if (updateErr) {
      return json({ error: updateErr.message }, 400);
    }

    return json({
      ok: true,
      request: updated,
    });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
