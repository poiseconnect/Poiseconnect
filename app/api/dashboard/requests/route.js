export const dynamic = "force-dynamic";

import {
  json,
  supabaseAdmin,
  getUserFromBearer,
} from "../../_lib/server";

function normalizeAdminTherapeuten(v) {
  if (typeof v === "string") {
    return v.trim() ? [v] : [];
  }
  if (!Array.isArray(v)) return [];
  return v;
}

export async function GET(req) {
  try {
    const { user, error } = await getUserFromBearer(req);
    if (!user) return json({ error }, 401);

    const sb = supabaseAdmin();

    const { data: member, error: memberErr } = await sb
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberErr || !member || member.active !== true) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    let query = sb
      .from("anfragen")
      .select(`
        id,
        created_at,
        vorname,
        nachname,
        email,
        telefon,
        strasse_hausnr,
        plz_ort,
        geburtsdatum,
        beschaeftigungsgrad,
        anliegen,
        leidensdruck,
        verlauf,
        ziel,
        diagnose,
        status,
        bevorzugte_zeit,
        wunschtherapeut,
        honorar_klient,
        admin_therapeuten,
        terminwunsch_text,
        assigned_therapist_id,
        booking_token,
        meeting_link_override
      `)
      .order("created_at", { ascending: false });

    if (member.role === "therapist") {
      query = query.eq("assigned_therapist_id", member.id);
    }

    const { data, error: reqErr } = await query;

    if (reqErr) {
      return json({ error: reqErr.message }, 400);
    }

    const requests = (data || []).map((r) => ({
      ...r,
      admin_therapeuten: normalizeAdminTherapeuten(r.admin_therapeuten),
    }));

    return json({
      role: member.role,
      myTeamMemberId: member.id,
      requests,
    });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
