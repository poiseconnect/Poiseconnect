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
  first_response_at,
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
  invoice_with_vat,
  admin_therapeuten,
  terminwunsch_text,
  assigned_therapist_id,
  booking_token,
  meeting_link_override,
  proposals_sent_at,
  proposals_count,
  proposals_opened_at
`)
      .order("created_at", { ascending: false });

    if (member.role === "therapist") {
      query = query.eq("assigned_therapist_id", member.id);
    }

    const { data, error: reqErr } = await query;

    if (reqErr) {
      return json({ error: reqErr.message }, 400);
    }

const requestIds = (data || [])
  .map((r) => r.id)
  .filter(Boolean);

let proposalRows = [];

if (requestIds.length > 0) {
  const { data: proposals, error: proposalsErr } = await sb
    .from("appointment_proposals")
    .select(`
      id,
      anfrage_id,
      therapist_id,
      date,
      expires_at,
      created_at
    `)
    .in("anfrage_id", requestIds)
    .order("date", { ascending: true });

  if (proposalsErr) {
    console.error(
      "DASHBOARD PROPOSALS LOAD ERROR:",
      proposalsErr
    );
  } else {
    proposalRows = proposals || [];
  }
}

const proposalsByRequest = {};

proposalRows.forEach((proposal) => {
  const requestId = String(proposal.anfrage_id);

  if (!proposalsByRequest[requestId]) {
    proposalsByRequest[requestId] = [];
  }

  proposalsByRequest[requestId].push(proposal);
});

const requests = (data || []).map((r) => ({
  ...r,
  admin_therapeuten: normalizeAdminTherapeuten(r.admin_therapeuten),
  proposal_times:
    proposalsByRequest[String(r.id)] || [],
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
