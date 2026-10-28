export const dynamic = "force-dynamic";

import { getActiveTeamMember, json as serverJson } from "../_lib/server";
import { mergeRequestHealth, readRequestHealth } from "../../lib/intakeAccess.js";

// kleine Helper-Funktion (optional, aber sauber)
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function POST(request) {
  try {
    const auth = await getActiveTeamMember(request);
    if (!auth.member) return serverJson({ error: auth.error }, auth.status);
    if (auth.member.role !== "therapist") {
      return serverJson({ error: "NO_ACCESS" }, 403);
    }

    const fields = `
      id, created_at, status, match_state, vorname, nachname, email, telefon,
      strasse_hausnr, plz_ort, geburtsdatum, beschaeftigungsgrad, coaching_typ,
      wunschtherapeut, assigned_therapist_id, bevorzugte_zeit, care_version, care_episode_id
    `;
    const assignedResult = await auth.supabase
        .from("anfragen")
        .select(fields)
        .eq("assigned_therapist_id", auth.member.id)
        .order("created_at", { ascending: false });

    const error = assignedResult.error;
    if (error) {
      console.error("TEAM REQUEST DB ERROR:", { code: error.code || null });
      return serverJson({ error: "db_error" }, 500);
    }

    const requests = new Map();
    for (const row of assignedResult.data || []) {
      requests.set(String(row.id), row);
    }

    return json({
      requests: mergeRequestHealth([...requests.values()], await readRequestHealth(
        auth.supabase, [...requests.keys()], auth.member.id
      )).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      ),
    });
  } catch {
    console.error("TEAM REQUEST SERVER ERROR");
    return json(
      { error: "server_error", detail: "INTERNAL_ERROR" },
      500
    );
  }
}
