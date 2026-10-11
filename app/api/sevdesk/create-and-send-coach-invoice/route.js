import { randomUUID } from "node:crypto";
import {
  getUserFromBearer,
  json,
  supabaseAdmin,
} from "../../_lib/server.js";
import { buildSevdeskPeriodFields } from "../../../lib/coachInvoiceDraft.js";
import {
  executeCoachInvoiceCreate,
  loadCoachInvoiceAutomationConfig,
  readCoachInvoiceStatus,
} from "../../../lib/coachInvoiceSevdesk.js";
import {
  loadCoachBillingContext,
} from "../../invoices/_lib/coachInvoice.js";
import { toSemanticBundleType } from "../../../lib/coachBilling.js";
import { getCoachInvoiceLinkState } from "../../../lib/coachInvoiceLink.js";
import {
  coachQuarterWorkflowUnavailableBody,
  getCoachQuarterWorkflowReadiness,
} from "../../../lib/coachQuarterWorkflowReadiness.js";

export const dynamic = "force-dynamic";

const SEVDESK_API_URL = "https://my.sevdesk.de/api/v1";

export async function POST(req) {
  const authorization = await authorizeAdmin(req);
  if (authorization.response) return authorization.response;

  const config = loadCoachInvoiceAutomationConfig();
  if (!config.enabled) {
    return json({ error: "sevdesk_live_workflow_blocked", reason: config.reason }, 503);
  }
  if (!process.env.SEVDESK_API_TOKEN) {
    return json({ error: "sevdesk_api_token_missing" }, 503);
  }
  const readiness = await getCoachQuarterWorkflowReadiness(authorization.supabase);
  if (!readiness.ready) {
    return json(coachQuarterWorkflowUnavailableBody(readiness), 503);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_request_body" }, 400);
  }
  const coachInvoiceId = String(body?.coachInvoiceId || "").trim();
  if (!coachInvoiceId) return json({ error: "missing_coach_invoice_id" }, 400);

  const repository = createRepository(authorization.supabase);
  const requestId = randomUUID();
  let result;
  try {
    result = await executeCoachInvoiceCreate({
      invoiceId: coachInvoiceId,
      adminId: authorization.member.id,
      repository,
      provider: createProvider(),
      config,
    });
  } catch {
    console.error("coach_invoice_sevdesk_workflow_failure", {
      requestId,
      phase: "workflow",
      code: "unhandled_workflow_error",
    });
    return json({ error: "invoice_workflow_failed", requestId }, 500);
  }
  if (result.status >= 500 || ["sevdesk_period_invoice_exists", "sevdesk_invoice_link_conflict"].includes(result.error)) {
    console.error("coach_invoice_sevdesk_workflow_failure", {
      requestId,
      phase: result.error?.includes("duplicate") || result.error?.includes("period_invoice")
        ? "duplicate_check"
        : "workflow",
      providerStatus: result.providerStatus || null,
      code: result.error || "workflow_failure",
    });
  }
  const { status, ...response } = result;
  return json({ ...response, requestId }, status);
}

export async function GET(req) {
  const authorization = await authorizeAdmin(req);
  if (authorization.response) return authorization.response;
  if (!process.env.SEVDESK_API_TOKEN) {
    return json({ error: "sevdesk_api_token_missing" }, 503);
  }

  const invoiceId = String(new URL(req.url).searchParams.get("coachInvoiceId") || "").trim();
  if (!invoiceId) return json({ error: "missing_coach_invoice_id" }, 400);

  const result = await readCoachInvoiceStatus({
    invoiceId,
    repository: createRepository(authorization.supabase),
    provider: createProvider(),
  });
  const { status, ...response } = result;
  return json(response, status);
}

async function authorizeAdmin(req) {
  const { user, error: authError } = await getUserFromBearer(req);
  if (!user) return { response: json({ error: authError || "NO_TOKEN" }, 401) };

  const supabase = supabaseAdmin();
  const { data: member, error: memberError } = await supabase
    .from("team_members")
    .select("id, role, active")
    .eq("user_id", user.id)
    .single();
  if (memberError || !member || member.active !== true || member.role !== "admin") {
    return { response: json({ error: "NO_ACCESS" }, 403) };
  }
  return { supabase, member };
}

function createRepository(supabase) {
  return {
    getLinkState: (id) => getCoachInvoiceLinkState(supabase, id),
    async getDraft(id) {
      const { data, error } = await supabase
        .from("coach_invoices")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error("coach_invoice_load_failed");
      return data;
    },

    async getCoach(id) {
      const [coachResult, taxResult] = await Promise.all([
        supabase
          .from("team_members")
          .select("id, role, active, email, profile_name, name, sevdesk_contact_id")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("therapist_invoice_settings")
          .select("company_name, address, business_country_code, vat_number, uid_confirmed_at, uid_confirmed_by, default_vat_rate")
          .eq("therapist_id", id)
          .maybeSingle(),
      ]);
      if (coachResult.error || taxResult.error) throw new Error("coach_load_failed");
      if (!coachResult.data || coachResult.data.active !== true || coachResult.data.role !== "therapist") {
        return { coach: null, taxProfile: null };
      }
      return { coach: coachResult.data, taxProfile: taxResult.data };
    },

    async getQuarterRelease(invoice) {
      const { data, error } = await supabase
        .from("coach_quarter_releases")
        .select("release_status, release_version")
        .eq("coach_id", invoice.coach_id)
        .eq("billing_year", invoice.billing_year)
        .eq("billing_quarter", invoice.billing_quarter)
        .maybeSingle();
      if (error) throw new Error("coach_quarter_release_load_failed");
      return data;
    },

    async getCurrentBundle(invoice) {
      const context = await loadCoachBillingContext(supabase, {
        coachId: invoice.coach_id,
        periodInput: {
          billingMode: "quartal",
          billingYear: invoice.billing_year,
          billingQuarter: invoice.billing_quarter,
        },
      });
      if (context.error) throw new Error("coach_billing_context_load_failed");
      const bundleType = toSemanticBundleType(invoice.bundle_key);
      return context.bundles.find((candidate) => candidate.bundle_type === bundleType) || null;
    },

    async reserveCreation({ invoiceId, adminId, releaseVersion, expectedUpdatedAt }) {
      const { data, error } = await supabase.rpc("reserve_coach_invoice_creation", {
        p_invoice_id: invoiceId,
        p_admin_id: adminId,
        p_release_version: releaseVersion,
        p_expected_updated_at: expectedUpdatedAt,
      });
      return error ? { error: error.code || "database_error" } : { status: data };
    },

    async markCreationUnknown(invoiceId, errorCode = "creation_unknown", candidateId = null) {
      return updateStatus(
        supabase,
        invoiceId,
        "creating",
        "creation_unknown",
        errorCode,
        candidateId
      );
    },

    async saveCreated({ invoiceId, sevdeskInvoiceId, draftInvoiceNumber }) {
      const { data, error } = await supabase
        .from("coach_invoices")
        .update({
          sevdesk_invoice_id: sevdeskInvoiceId,
          sevdesk_draft_invoice_number: draftInvoiceNumber,
          sevdesk_send_status: "created",
          sevdesk_send_error_code: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId)
        .eq("sevdesk_send_status", "creating")
        .select("id")
        .maybeSingle();
      return !error && Boolean(data?.id);
    },
  };
}

async function updateStatus(
  supabase,
  invoiceId,
  expectedStatus,
  nextStatus,
  errorCode = null,
  candidateId = null
) {
  const { data, error } = await supabase
    .from("coach_invoices")
    .update({
      sevdesk_send_status: nextStatus,
      ...(candidateId ? { sevdesk_creation_candidate_id: candidateId } : {}),
      sevdesk_send_error_code: nextStatus.endsWith("unknown")
        ? errorCode || nextStatus
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("sevdesk_send_status", expectedStatus)
    .select("id")
    .maybeSingle();
  return !error && Boolean(data?.id);
}

function createProvider() {
  return {
    getBookkeepingSystemVersion: async () => {
      const response = await sevdeskFetch("/Tools/bookkeepingSystemVersion");
      return response?.objects?.version || null;
    },

    getContact: async (id) => {
      const response = await sevdeskFetch(`/Contact/${encodeURIComponent(id)}`);
      const contact = response?.objects;
      return Array.isArray(contact) ? contact[0] : contact;
    },

    getContactEmails: async (id) => {
      const query = new URLSearchParams({
        "contact[id]": String(id),
        "contact[objectName]": "Contact",
        type: "EMAIL",
      });
      const response = await sevdeskFetch(`/CommunicationWay?${query}`);
      return Array.isArray(response?.objects) ? response.objects : [];
    },

    findInvoicesForQuarter: async ({ contactId, invoice }) => {
      const query = new URLSearchParams({
        "contact[id]": String(contactId),
        "contact[objectName]": "Contact",
      });
      const invoices = await sevdeskFetchAllObjects("/Invoice", query);

      const fields = buildSevdeskPeriodFields(invoice);
      const expectedHeader = `Provision ${String(invoice.service_period || "").trim()}`
        .toLocaleLowerCase("de-AT");
      const expectedNote = `${invoice.billing_quarter}. Quartal ${invoice.billing_year}`
        .toLocaleLowerCase("de-AT");
      const expectedStart = new Date(fields.deliveryDate).getTime();
      const expectedEnd = Number(fields.deliveryDateUntil) * 1000;

      return invoices.flatMap((candidate) => {
        const contactMatches =
          String(candidate?.contact?.id || "") === String(contactId) &&
          candidate?.contact?.objectName === "Contact";
        if (!contactMatches) {
          return [{ ...candidate, __poisePeriodMatch: "unknown" }];
        }

        const headerText = String(candidate?.header || "").trim();
        const noteText = String(candidate?.customerInternalNote || "").trim();
        const header = headerText.toLocaleLowerCase("de-AT");
        const note = noteText.toLocaleLowerCase("de-AT");
        const start = Date.parse(candidate?.deliveryDate || "");
        const end = Date.parse(candidate?.deliveryDateUntil || "");
        const hasCompleteServiceDates = Number.isFinite(start) && Number.isFinite(end);
        const datesMatch = hasCompleteServiceDates &&
          start === expectedStart && end === expectedEnd;
        const headerMatches = header === expectedHeader;
        const noteMatches = note === expectedNote;
        const headerIsQuarter = /^provision\s+(?:q[1-4]|\d\.\s*quartal)\s+\d{4}$/i
          .test(headerText);
        const noteIsQuarter = /^(?:q[1-4]|\d\.\s*quartal)\s+\d{4}$/i
          .test(noteText);
        const hasSamePeriodEvidence = datesMatch || headerMatches || noteMatches;
        const hasConflictingPeriodEvidence =
          (hasCompleteServiceDates && !datesMatch) ||
          (headerIsQuarter && !headerMatches) ||
          (noteIsQuarter && !noteMatches);

        if (!hasSamePeriodEvidence && hasConflictingPeriodEvidence) return [];
        return [{
          ...candidate,
          __poisePeriodMatch:
            hasSamePeriodEvidence && !hasConflictingPeriodEvidence
              ? "same_period"
              : "unknown",
        }];
      });
    },

    getInvoicePositions: async (id) => {
      return sevdeskFetchAllObjects(
        `/Invoice/${encodeURIComponent(id)}/getPositions`
      );
    },

    createInvoice: (payload) => sevdeskFetch("/Invoice/Factory/saveInvoice", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

    getInvoice: async (id) => {
      const response = await sevdeskFetch(`/Invoice/${encodeURIComponent(id)}`);
      const invoice = response?.objects;
      return Array.isArray(invoice) ? invoice[0] : invoice;
    },
  };
}

async function sevdeskFetchAllObjects(path, query = new URLSearchParams()) {
  const pageSize = 1000;
  const maxPages = 100;
  const objects = [];
  let offset = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const pageQuery = new URLSearchParams(query);
    pageQuery.set("limit", String(pageSize));
    pageQuery.set("offset", String(offset));
    const response = await sevdeskFetch(`${path}?${pageQuery}`);
    if (!Array.isArray(response?.objects) || response.objects.length > pageSize) {
      throw Object.assign(new Error("sevdesk_list_response_incomplete"), {
        code: "sevdesk_list_response_incomplete",
      });
    }
    objects.push(...response.objects);
    if (response.objects.length < pageSize) return objects;
    offset += response.objects.length;
  }

  throw Object.assign(new Error("sevdesk_list_page_limit_reached"), {
    code: "sevdesk_list_page_limit_reached",
  });
}

async function sevdeskFetch(path, options = {}) {
  const apiToken = process.env.SEVDESK_API_TOKEN;
  if (!apiToken) throw new Error("sevdesk_api_token_missing");
  const response = await fetch(`${SEVDESK_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: apiToken,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error("sevdesk_request_failed"), {
      code: "sevdesk_http_error",
      status: response.status,
    });
  }
  return data;
}
