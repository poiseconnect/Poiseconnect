export const dynamic = "force-dynamic";

import {
  canAccessAssignedRequest,
  json,
  getActiveTeamMember,
} from "../_lib/server";
import { closeConversation } from "../../lib/messaging/conversations";

export async function POST(req) {
  try {
    const auth = await getActiveTeamMember(req);
    if (!auth.member) return json({ error: auth.error }, auth.status);

    const body = await req.json();
    const requestId = body.requestId;
    const status = body.status;

    if (!requestId) {
      return json({ error: "MISSING_REQUEST_ID" }, 400);
    }

    if (!status) {
      return json({ error: "MISSING_STATUS" }, 400);
    }

    const sb = auth.supabase;
    const member = auth.member;

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
    if (!canAccessAssignedRequest(member, anfrage.assigned_therapist_id)) {
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
      "admin_vorschlaege_gesendet",
      "papierkorb",
      "beendet",
      "kein_match",
    ];

    if (!allowedStatuses.includes(String(status))) {
      return json({ error: "INVALID_STATUS" }, 400);
    }

    // 5) Update with ownership in the write filter to prevent stale-assignment writes.
    let update = sb
      .from("anfragen")
      .update({ status })
      .eq("id", requestId);
    if (member.role === "therapist") {
      update = update.eq("assigned_therapist_id", member.id);
    }
    const { data: updated, error: updateErr } = await update
      .select("id, status")
      .single();

    if (updateErr) {
      return json({ error: "UPDATE_FAILED" }, 400);
    }

    if (["beendet", "papierkorb", "kein_match", "abgelehnt"].includes(String(status))) {
      await closeConversation({
        supabase: sb,
        anfrageId: requestId,
        reason: String(status),
      });
    }

    return json({
      ok: true,
      request: updated,
    });
  } catch {
    return json({ error: "SERVER_ERROR", detail: "INTERNAL_ERROR" }, 500);
  }
}
