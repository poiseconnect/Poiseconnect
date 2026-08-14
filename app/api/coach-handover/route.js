export const dynamic = "force-dynamic";

import {
  getUserFromBearer,
  json,
  supabaseAdmin,
} from "../_lib/server";

export async function POST(request) {
  try {
    const { user, error: authError } = await getUserFromBearer(request);
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

    if (member.role !== "admin" && member.role !== "therapist") {
      return json({ error: "NO_ACCESS" }, 403);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }

    const { anfrageId, handoverType } = body || {};
    if (!anfrageId) return json({ error: "MISSING_ANFRAGE_ID" }, 400);

    if (!['not_match', 'therapist_change'].includes(handoverType)) {
      return json({ error: "INVALID_HANDOVER_TYPE" }, 400);
    }

    const { data: anfrage, error: anfrageErr } = await sb
      .from("anfragen")
      .select(
        "id, assigned_therapist_id, wunschtherapeut, excluded_therapeuten, vorname, nachname, email, telefon, strasse_hausnr, plz_ort, geburtsdatum, beschaeftigungsgrad, coaching_typ, anliegen, ziel, leidensdruck, verlauf, diagnose"
      )
      .eq("id", anfrageId)
      .single();

    if (anfrageErr || !anfrage) {
      return json({ error: "REQUEST_NOT_FOUND" }, 404);
    }

    if (
      member.role === "therapist" &&
      String(anfrage.assigned_therapist_id || "") !== String(member.id)
    ) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const { data: sessions, error: sessionsErr } = await sb
      .from("sessions")
      .select("id")
      .eq("anfrage_id", anfrage.id)
      .limit(1);

    if (sessionsErr) {
      return json({ error: "SESSION_CHECK_FAILED" }, 500);
    }

    if (sessions?.length > 0 && handoverType !== "therapist_change") {
      return json({ error: "SESSION_HISTORY_REQUIRES_THERAPIST_CHANGE" }, 409);
    }

    const excludedTherapist = anfrage.wunschtherapeut || null;
    const existingExcluded = Array.isArray(anfrage.excluded_therapeuten)
      ? anfrage.excluded_therapeuten
      : [];
    const excludedTherapeuten = excludedTherapist
      ? [...new Set([...existingExcluded, excludedTherapist])]
      : existingExcluded;

    if (!sessions || sessions.length === 0) {
      const { error: updateErr } = await sb
        .from("anfragen")
        .update({
          status: "admin_weiterleiten",
          assigned_therapist_id: null,
          wunschtherapeut: null,
          admin_therapeuten: [],
          bevorzugte_zeit: null,
          excluded_therapeuten: excludedTherapeuten,
        })
        .eq("id", anfrage.id);

      if (updateErr) return json({ error: "UPDATE_FAILED" }, 500);

      return json({ ok: true, mode: "existing", requestId: anfrage.id });
    }

    const { data: created, error: insertErr } = await sb
      .from("anfragen")
      .insert({
        vorname: anfrage.vorname || null,
        nachname: anfrage.nachname || null,
        email: anfrage.email || null,
        telefon: anfrage.telefon || null,
        strasse_hausnr: anfrage.strasse_hausnr || null,
        plz_ort: anfrage.plz_ort || null,
        geburtsdatum: anfrage.geburtsdatum || null,
        beschaeftigungsgrad: anfrage.beschaeftigungsgrad || null,
        coaching_typ: anfrage.coaching_typ === "paar" ? "paar" : "einzel",
        anliegen: anfrage.anliegen || null,
        ziel: anfrage.ziel || null,
        leidensdruck: anfrage.leidensdruck || null,
        verlauf: anfrage.verlauf || null,
        diagnose: anfrage.diagnose || null,
        status: "admin_weiterleiten",
        match_state: "pending",
        assigned_therapist_id: null,
        wunschtherapeut: null,
        admin_therapeuten: [],
        booking_token: crypto.randomUUID(),
        bevorzugte_zeit: null,
        excluded_therapeuten: excludedTherapeuten,
      })
      .select("id")
      .single();

    if (insertErr || !created) {
      return json({ error: "CREATE_REQUEST_FAILED" }, 500);
    }

    return json({ ok: true, mode: "new", requestId: created.id });
  } catch {
    return json({ error: "SERVER_ERROR" }, 500);
  }
}
