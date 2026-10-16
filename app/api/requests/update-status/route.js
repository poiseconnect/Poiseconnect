export const dynamic = "force-dynamic";

import {
  canAccessAssignedRequest,
  getActiveTeamMember,
  json,
} from "../../_lib/server";
import { confirmAppointment } from "../../../lib/handlers/confirmAppointment";

export async function POST(request) {
  try {
    const auth = await getActiveTeamMember(request);
    if (!auth.member) return json({ error: auth.error }, auth.status);

    const body = await request.json();
    const { requestId, status } = body;

    if (!requestId || !status) {
      return json({ error: "missing_fields" }, 400);
    }

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

    const { data: existing, error: loadError } = await auth.supabase
      .from("anfragen")
      .select("id, status, first_response_at, assigned_therapist_id, email, vorname")
      .eq("id", requestId)
      .maybeSingle();

    if (loadError) return json({ error: "REQUEST_LOAD_FAILED" }, 500);
    if (!existing) return json({ error: "REQUEST_NOT_FOUND" }, 404);
    if (!canAccessAssignedRequest(auth.member, existing.assigned_therapist_id)) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    if (status === "termin_bestaetigt") {
      await confirmAppointment({
        supabase: auth.supabase,
        requestId,
        expectedAssignedTherapistId:
          auth.member.role === "therapist" ? auth.member.id : null,
        client: existing.email,
        vorname: existing.vorname,
      });
      return json({ ok: true });
    }

    const updateData = { status };
    if (!existing.first_response_at) {
      updateData.first_response_at = new Date().toISOString();
    }

    let update = auth.supabase
      .from("anfragen")
      .update(updateData)
      .eq("id", requestId);
    if (auth.member.role === "therapist") {
      update = update.eq("assigned_therapist_id", auth.member.id);
    }
    const { data: updated, error } = await update
      .select("id")
      .maybeSingle();

    if (error || !updated) {
      return json({ error: "UPDATE_FAILED" }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("UPDATE STATUS SERVER ERROR");
    return json({ error: "server_error" }, 500);
  }
}
