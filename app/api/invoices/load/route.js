export const dynamic = "force-dynamic";

import {
  json,
  supabaseAdmin,
  getUserFromBearer,
} from "../../_lib/server";

export async function GET(req) {
  try {
    const { user, error } = await getUserFromBearer(req);
    if (!user) return json({ error }, 401);

    const url = new URL(req.url);
    const anfrageId = url.searchParams.get("id");

    if (!anfrageId) {
      return json({ error: "MISSING_ID" }, 400);
    }

    const sb = supabaseAdmin();

    const { data: member, error: memberErr } = await sb
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberErr || !member || member.active !== true) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    let anfrageQuery = sb
      .from("anfragen")
      .select("*")
      .eq("id", anfrageId);

    if (member.role === "therapist") {
      anfrageQuery = anfrageQuery.eq("assigned_therapist_id", member.id);
    }

    const { data: anfrage, error: anfrageErr } = await anfrageQuery.single();

    if (anfrageErr || !anfrage) {
      return json({ error: "ANFRAGE_NOT_FOUND" }, 404);
    }

let sessionsQuery = sb
  .from("sessions")
  .select("*")
  .eq("anfrage_id", anfrageId);

const billingMode = url.searchParams.get("billingMode");
const billingYear = Number(url.searchParams.get("billingYear"));
const billingMonth = Number(url.searchParams.get("billingMonth"));
const billingQuarter = Number(url.searchParams.get("billingQuarter"));

if (billingMode === "monat" && billingYear && billingMonth) {
  const start = `${billingYear}-${String(billingMonth).padStart(2, "0")}-01`;
  const endDate = new Date(billingYear, billingMonth, 0);
  const end = `${billingYear}-${String(billingMonth).padStart(2, "0")}-${String(
    endDate.getDate()
  ).padStart(2, "0")}`;

  sessionsQuery = sessionsQuery.gte("date", start).lte("date", end);
}

if (billingMode === "quartal" && billingYear && billingQuarter) {
  const startMonth = (billingQuarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;

  const start = `${billingYear}-${String(startMonth).padStart(2, "0")}-01`;
  const endDate = new Date(billingYear, endMonth, 0);
  const end = `${billingYear}-${String(endMonth).padStart(2, "0")}-${String(
    endDate.getDate()
  ).padStart(2, "0")}`;

  sessionsQuery = sessionsQuery.gte("date", start).lte("date", end);
}

const { data: sessions, error: sessErr } = await sessionsQuery.order("date", {
  ascending: true,
});

    if (sessErr) {
      return json({ error: sessErr.message }, 400);
    }
    const therapistId =
      anfrage.assigned_therapist_id ||
      sessions?.[0]?.therapist_id ||
      null;

    let settings = null;
    let coach = null;

    if (therapistId) {
      const { data: invSet } = await sb
        .from("therapist_invoice_settings")
        .select("*")
        .eq("therapist_id", therapistId)
        .single();

      settings = invSet || null;

      const { data: coachMember } = await sb
        .from("team_members")
        .select("id, name, email")
        .eq("id", therapistId)
        .single();

      coach = coachMember || null;
    }

    return json({
      anfrage,
      sessions: sessions || [],
      settings,
      coach,
    });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: String(e) }, 500);
  }
}
