export const dynamic = "force-dynamic";

import { getActiveTeamMember, json } from "../../_lib/server";
import { mergeRequestHealth, readRequestHealth } from "../../../lib/intakeAccess.js";

const DRAFT_FIELDS = [
  "id", "created_at", "status", "match_state", "booking_token",
  "vorname", "nachname", "email", "telefon", "strasse_hausnr",
  "plz_ort", "geburtsdatum", "beschaeftigungsgrad",
  "coaching_typ", "wunschtherapeut", "assigned_therapist_id",
  "admin_therapeuten", "structured_time_preference", "bevorzugte_zeit",
  "draft_current_step",
].join(", ");

export async function GET(req) {
  const auth = await getActiveTeamMember(req);
  if (!auth.member) return json({ error: auth.error }, auth.status);
  if (auth.member.role !== "admin") return json({ error: "NO_ACCESS" }, 403);

  const { data, error } = await auth.supabase
    .from("anfragen")
    .select(DRAFT_FIELDS)
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  if (error) {
    return json({ error: "INTERNAL_ERROR" }, 500);
  }

  try {
    const health = await readRequestHealth(
      auth.supabase, (data || []).map((row) => row.id), auth.member.id
    );
    return json({ drafts: mergeRequestHealth(data || [], health) });
  } catch {
    console.error("HEALTH_DATA_ACCESS_UNAVAILABLE");
    return json({ error: "HEALTH_DATA_ACCESS_UNAVAILABLE" }, 503);
  }
}
