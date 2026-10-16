export const dynamic = "force-dynamic";

import {
  canAccessAssignedRequest,
  getActiveTeamMember,
} from "../_lib/server";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request) {
  try {
    const auth = await getActiveTeamMember(request);
    if (!auth.member) return json({ error: auth.error }, auth.status);
    if (!["admin", "therapist"].includes(auth.member.role)) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const body = await request.json();

    const {
      anfrageId,
      vorname,
      nachname,
      email,
      telefon,
      strasse_hausnr,
      plz_ort,
      geburtsdatum,
      beschaeftigungsgrad,
    } = body || {};

    if (!anfrageId) {
      return json({ error: "MISSING_ID" }, 400);
    }

    const { data: requestRow, error: loadError } = await auth.supabase
      .from("anfragen")
      .select("id, assigned_therapist_id")
      .eq("id", anfrageId)
      .maybeSingle();
    if (loadError) return json({ error: "REQUEST_LOAD_FAILED" }, 500);
    if (!requestRow) return json({ error: "REQUEST_NOT_FOUND" }, 404);
    if (!canAccessAssignedRequest(auth.member, requestRow.assigned_therapist_id)) {
      return json({ error: "NO_ACCESS" }, 403);
    }
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return json({ error: "INVALID_EMAIL" }, 400);
    }

    let update = auth.supabase
      .from("anfragen")
      .update({
        vorname: vorname || null,
        nachname: nachname || null,
        email: email.trim(),
        telefon: telefon || null,
        strasse_hausnr: strasse_hausnr || null,
        plz_ort: plz_ort || null,
        geburtsdatum: geburtsdatum || null,
        beschaeftigungsgrad: beschaeftigungsgrad || null,
      })
      .eq("id", anfrageId);
    if (auth.member.role === "therapist") {
      update = update.eq("assigned_therapist_id", auth.member.id);
    }
    const { data: updated, error } = await update.select("id").maybeSingle();

    if (!error && !updated) return json({ error: "REQUEST_ASSIGNMENT_CHANGED" }, 409);
    if (error) {
      console.error("UPDATE CLIENT DB ERROR:", { code: error?.code || null });
      return json(
        {
          error: "DB_ERROR",
          detail: "INTERNAL_ERROR",
        },
        500
      );
    }

    return json({ ok: true });
  } catch {
    console.error("UPDATE CLIENT SERVER ERROR");
    return json(
      {
        error: "SERVER_ERROR",
        detail: "INTERNAL_ERROR",
      },
      500
    );
  }
}
