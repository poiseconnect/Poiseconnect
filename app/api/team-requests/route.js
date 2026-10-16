export const dynamic = "force-dynamic";

import { getActiveTeamMember, json as serverJson } from "../_lib/server";

// kleine Helper-Funktion (optional, aber sauber)
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
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
      strasse_hausnr, plz_ort, geburtsdatum, beschaeftigungsgrad, themen,
      anliegen, leidensdruck, verlauf, diagnose, ziel, coaching_typ,
      wunschtherapeut, assigned_therapist_id, bevorzugte_zeit, terminwunsch_text
    `;
    const [assignedResult, requestedResult] = await Promise.all([
      auth.supabase
        .from("anfragen")
        .select(fields)
        .eq("assigned_therapist_id", auth.member.id)
        .order("created_at", { ascending: false }),
      auth.member.email
        ? auth.supabase
            .from("anfragen")
            .select(fields)
            .eq("wunschtherapeut", auth.member.email)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    const error = assignedResult.error || requestedResult.error;
    if (error) {
      console.error("TEAM REQUEST DB ERROR:", { code: error.code || null });
      return serverJson({ error: "db_error" }, 500);
    }

    const requests = new Map();
    for (const row of [...(assignedResult.data || []), ...(requestedResult.data || [])]) {
      requests.set(String(row.id), row);
    }

    return json({
      requests: [...requests.values()].sort(
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
