export const dynamic = "force-dynamic";

import { ensureOpenConversation } from "../../lib/messaging/conversations";
import { getActiveTeamMember, json as serverJson } from "../_lib/server";

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
    if (!["admin", "therapist"].includes(auth.member.role)) {
      return serverJson({ error: "NO_ACCESS" }, 403);
    }

    const body = await request.json();

    const {
      vorname,
      nachname,
      email,
      telefon,
      strasse_hausnr,
      plz_ort,
      geburtsdatum,
      beschaeftigungsgrad,
      wunschtherapeut,
      therapist_id,
    } = body || {};

    if (!vorname || !nachname || !wunschtherapeut || !therapist_id) {
      return json({ error: "MISSING_FIELDS" }, 400);
    }

    const { data: targetMember, error: targetError } = await auth.supabase
      .from("team_members")
      .select("id, profile_name, role, active")
      .eq("id", therapist_id)
      .maybeSingle();
    if (targetError) return json({ error: "TEAM_LOAD_FAILED" }, 500);
    if (
      !targetMember ||
      targetMember.active !== true ||
      targetMember.role !== "therapist"
    ) {
      return json({ error: "INVALID_THERAPIST" }, 400);
    }
    if (
      auth.member.role === "therapist" &&
      String(therapist_id) !== String(auth.member.id)
    ) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const { data: created, error } = await auth.supabase.from("anfragen").insert({
      vorname,
      nachname,
      email: email || null,
      telefon: telefon || null,
      strasse_hausnr: strasse_hausnr || null,
      plz_ort: plz_ort || null,
      geburtsdatum: geburtsdatum || null,
      beschaeftigungsgrad: beschaeftigungsgrad || null,
      wunschtherapeut: targetMember.profile_name || wunschtherapeut,
      assigned_therapist_id: therapist_id,
      status: "active",
      quelle: "bestand",
    }).select("id").single();

    if (error) {
      console.error("CREATE BESTAND DB ERROR:", { code: error?.code || null });
      return json(
        { error: "DB_ERROR", detail: "INTERNAL_ERROR" },
        500
      );
    }

    await ensureOpenConversation({
      supabase: auth.supabase,
      anfrageId: created.id,
      therapistId: therapist_id,
    });

    return json({ ok: true });
  } catch (err) {
    console.error("CREATE BESTAND SERVER ERROR");
    return json(
      { error: "SERVER_ERROR", detail: "INTERNAL_ERROR" },
      500
    );
  }
}
