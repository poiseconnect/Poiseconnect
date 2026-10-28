import {
  json,
  getUserFromBearer,
  supabaseAdmin,
} from "../../_lib/server";
import {
  billingOwnerIds,
  billingCareVersion,
  billingMutationError,
  ownsBillingRow,
  ownerAliases,
  resolveBillingOwner,
  validateInvoiceSessions,
  validClientInvoiceBody,
} from "../../_lib/billingAccess";

export async function POST(req) {
  const { user, error: authError } = await getUserFromBearer(req);
  if (!user) {
    return json({ error: authError || "NO_TOKEN" }, 401);
  }

  const sb = supabaseAdmin();

  const { data: member, error: memberErr } = await sb
    .from("team_members")
    .select("id, user_id, role, active")
    .eq("user_id", user.id)
    .single();

  if (memberErr || !member || member.active !== true) {
    return json({ error: "NO_ACCESS" }, 403);
  }

  const isAdmin = member.role === "admin";
  const isTherapist = member.role === "therapist";

  if (!isAdmin && !isTherapist) {
    return json({ error: "NO_ACCESS" }, 403);
  }

  const body = await req.json();
  if (!validClientInvoiceBody(body)) {
    return json({ error: "INVALID_INVOICE_PAYLOAD" }, 400);
  }
  const { id, therapist_id, ...invoiceData } = body;
  const ownIds = billingOwnerIds(member, user);

  try {
    let invoicePayload = {
      ...invoiceData,
      updated_at: new Date().toISOString(),
    };

    let existingInvoice = null;
    let assignment = null;
    if (id) {
      const { data, error: existingInvoiceErr } = await sb
        .from("invoices")
        .select("id, therapist_id, anfrage_id, line_items")
        .eq("id", id)
        .single();

      existingInvoice = data;
      if (existingInvoiceErr || !existingInvoice) {
        return json({ error: "INVOICE_NOT_FOUND" }, 404);
      }

      if (
        isTherapist &&
        !ownsBillingRow(existingInvoice, ownIds)
      ) {
        return json({ error: "NO_ACCESS" }, 403);
      }
      if (invoiceData.anfrage_id !== undefined &&
          String(invoiceData.anfrage_id) !== String(existingInvoice.anfrage_id)) {
        return json({ error: "INVOICE_REQUEST_IMMUTABLE" }, 403);
      }

      invoicePayload = {
        ...invoicePayload,
        therapist_id: existingInvoice.therapist_id,
        anfrage_id: existingInvoice.anfrage_id,
      };
    } else {
      const anfrageId = String(invoiceData.anfrage_id || "");

      if (!anfrageId) {
        return json({ error: "MISSING_ANFRAGE_ID" }, 400);
      }

      const { data: anfrage, error: anfrageErr } = await sb
        .from("anfragen")
        .select("id, assigned_therapist_id, care_version")
        .eq("id", anfrageId)
        .single();

      if (anfrageErr || !anfrage) {
        return json({ error: "ANFRAGE_NOT_FOUND" }, 404);
      }
      assignment = anfrage;

      if (
        isTherapist &&
        !ownIds.includes(String(anfrage.assigned_therapist_id || ""))
      ) {
        return json({ error: "NO_ACCESS" }, 403);
      }

      invoicePayload = {
        ...invoicePayload,
        therapist_id: anfrage.assigned_therapist_id || null,
      };
    }

    if (existingInvoice) {
      const { data, error: assignmentError } = await sb.from("anfragen")
        .select("id, assigned_therapist_id, care_version")
        .eq("id", existingInvoice.anfrage_id).single();
      if (assignmentError || !data) {
        return json({ error: "BILLING_MUTATION_UNAVAILABLE" }, 503);
      }
      assignment = data;
      if (isTherapist &&
          !ownIds.includes(String(assignment.assigned_therapist_id || ""))) {
        return json({ error: "HISTORICAL_INVOICE_READ_ONLY" }, 403);
      }
    }
    const expectedVersion = billingCareVersion(assignment?.care_version);
    if (expectedVersion === null) {
      return json({ error: "BILLING_MUTATION_UNAVAILABLE" }, 503);
    }

    const ownerIds = isTherapist ? ownIds :
      ownerAliases(await resolveBillingOwner(sb, invoicePayload.therapist_id));
    if (!await validateInvoiceSessions(sb, {
      ...invoicePayload,
      line_items: invoicePayload.line_items ?? existingInvoice?.line_items,
    }, ownerIds)) {
      return json({ error: "INVALID_INVOICE_SESSIONS" }, 403);
    }

    const { data, error } = await sb.rpc("privacy_save_client_invoice", {
      p_actor_id: user.id,
      p_invoice_id: id || null,
      p_request_id: invoicePayload.anfrage_id,
      p_expected_version: expectedVersion,
      p_payload: invoicePayload,
    });

    if (error) {
      const failure = billingMutationError(error);
      return json({ error: failure.error }, failure.status);
    }
    if (!data || typeof data !== "object" || Array.isArray(data) || !data.id ||
        (id && String(data.id) !== String(id)) ||
        String(data.anfrage_id) !== String(invoicePayload.anfrage_id) ||
        String(data.therapist_id || "") !== String(invoicePayload.therapist_id || "")) {
      return json({ error: "BILLING_MUTATION_UNAVAILABLE" }, 503);
    }

    return json({ data }, 200);
  } catch (e) {
    return json({ error: "BILLING_MUTATION_UNAVAILABLE" }, 503);
  }
}
