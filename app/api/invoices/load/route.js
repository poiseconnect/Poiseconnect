export const dynamic = "force-dynamic";

import {
  json,
  supabaseAdmin,
  getUserFromBearer,
} from "../../_lib/server";
import {
  BILLING_REQUEST_FIELDS,
  BILLING_SESSION_FIELDS,
  billingOwnerIds,
  ownsBillingRow,
  ownerAliases,
  resolveBillingOwner,
  viennaBillingDate,
} from "../../_lib/billingAccess";

export async function GET(req) {
  try {
    const { user, error } = await getUserFromBearer(req);
    if (!user) return json({ error }, 401);

    const url = new URL(req.url);
    let anfrageId = url.searchParams.get("id");
    const invoiceId = url.searchParams.get("invoiceId");
    const requestedTherapistId = url.searchParams.get("therapistId");

    if (!anfrageId && !invoiceId) {
      return json({ error: "MISSING_ID" }, 400);
    }

    const sb = supabaseAdmin();

    const { data: member, error: memberErr } = await sb
      .from("team_members")
      .select("id, user_id, role, active")
      .eq("user_id", user.id)
      .single();

    if (memberErr || !member || member.active !== true ||
        !["admin", "therapist"].includes(member.role)) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const ownIds = billingOwnerIds(member, user);
    if (member.role === "therapist" && requestedTherapistId &&
        !ownIds.includes(requestedTherapistId)) {
      return json({ error: "NO_ACCESS" }, 403);
    }
    let invoice = null;
    if (invoiceId) {
      const { data, error: invoiceError } = await sb.from("invoices")
        .select("*").eq("id", invoiceId).maybeSingle();
      if (invoiceError) return json({ error: "invoice_load_failed" }, 500);
      if (!data || (member.role === "therapist" && !ownsBillingRow(data, ownIds)) ||
          (anfrageId && String(data.anfrage_id) !== anfrageId)) {
        return json({ error: "NO_ACCESS" }, 403);
      }
      invoice = data;
      anfrageId = String(data.anfrage_id);
    }

    // Only the assignment is inspected until a current-care or own billing
    // relationship is established; historical reads do not fetch live identity.
    const { data: assignment, error: anfrageErr } = await sb.from("anfragen")
      .select("id, assigned_therapist_id").eq("id", anfrageId).single();

    if (anfrageErr || !assignment) {
      return json({ error: "ANFRAGE_NOT_FOUND" }, 404);
    }

    const owner = member.role === "therapist" ? member :
      await resolveBillingOwner(sb,
        invoice?.therapist_id || requestedTherapistId || assignment.assigned_therapist_id);
    const ownerIds = member.role === "therapist" ? ownIds : ownerAliases(owner);
    if (requestedTherapistId && !ownerIds.includes(requestedTherapistId)) {
      return json({ error: "NO_ACCESS" }, 403);
    }
    const currentOwner = ownerIds.includes(String(assignment.assigned_therapist_id || ""));
    if (!invoice) {
      const { data, error: invoiceError } = await sb.from("invoices")
        .select("*").eq("anfrage_id", anfrageId)
        .in("therapist_id", ownerIds)
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (invoiceError) return json({ error: "invoice_load_failed" }, 500);
      invoice = data || null;
    }

let sessionsQuery = sb
  .from("sessions")
  .select(BILLING_SESSION_FIELDS)
  .eq("anfrage_id", anfrageId)
  .in("therapist_id", ownerIds);
if (!currentOwner) sessionsQuery = sessionsQuery.lte("date", viennaBillingDate());

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
      return json({ error: "SESSIONS_LOAD_FAILED" }, 400);
    }
    if (!currentOwner && !invoice && !sessions?.length) {
      return json({ error: "NO_ACCESS" }, 403);
    }
    let anfrage = {
      id: anfrageId,
      ...(invoice ? { invoice_with_vat: Number(invoice.vat_rate || 0) > 0 } : {}),
    };
    if (currentOwner) {
      let billingQuery = sb.from("anfragen")
        .select(BILLING_REQUEST_FIELDS).eq("id", anfrageId);
      if (member.role === "therapist") {
        billingQuery = billingQuery.in("assigned_therapist_id", ownIds);
      }
      const { data, error: billingError } = await billingQuery.single();
      if (billingError || !data) return json({ error: "ANFRAGE_NOT_FOUND" }, 404);
      anfrage = data;
    }
    const therapistId = owner?.id || null;

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
      invoice,
      historicalBillingOnly: !currentOwner,
    });
  } catch (e) {
    return json({ error: "SERVER_ERROR", detail: "INTERNAL_ERROR" }, 500);
  }
}
