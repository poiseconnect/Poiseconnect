export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import {
  invoiceLineItemsFromBundle,
  loadCoachBillingContext,
  loadCoachInvoice,
} from "../_lib/coachInvoice";
import {
  toSemanticBundleType,
} from "../../../lib/coachBilling.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TABLE_NAME = "coach_invoices";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getUserFromBearer(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.error("GET USER FROM TOKEN ERROR:", { code: error?.code || null });
    return null;
  }

  return user;
}

async function requireAdmin(req) {
  const user = await getUserFromBearer(req);
  if (!user) return { error: json({ error: "unauthorized" }, 401) };

  const { data: member, error } = await supabase
    .from("team_members")
    .select("id, email, role, active")
    .eq("email", user.email)
    .single();

  if (error || !member || member.active !== true || member.role !== "admin") {
    return { error: json({ error: "forbidden" }, 403) };
  }

  return { user, member };
}

function normalizeString(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function normalizeIntegerOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export async function POST(req) {
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;

    const body = await req.json();

    const coachId = normalizeString(body.coach_id);
    const billingMode = normalizeString(body.billing_mode);
    const billingYear = normalizeIntegerOrNull(body.billing_year);
    const billingQuarter = normalizeIntegerOrNull(body.billing_quarter);
    const billingMonth = normalizeIntegerOrNull(body.billing_month);
    const bundleKey = normalizeString(body.bundle_key);
    const bundleType =
      normalizeString(body.bundle_type) || toSemanticBundleType(bundleKey);

    if (!coachId) {
      return json({ error: "missing_coach_id" }, 400);
    }

    if (!billingMode) {
      return json({ error: "missing_billing_mode" }, 400);
    }

    if (!bundleType) {
      return json({ error: "missing_bundle_key" }, 400);
    }

    const periodInput = {
      billingMode,
      billingYear,
      billingQuarter,
      billingMonth,
      billingDate: body.billing_date,
    };
    const context = await loadCoachBillingContext(supabase, {
      coachId,
      periodInput,
    });
    if (context.error) {
      return json({ error: "billing_context_load_failed" }, 500);
    }
    if (!context.period.invoiceSupported) {
      return json({ error: "single_day_invoice_not_supported" }, 400);
    }

    const bundle = context.bundles.find(
      (candidate) => candidate.bundle_type === bundleType
    );
    if (!bundle) return json({ error: "no_current_sessions_for_bundle" }, 409);
    if (bundle.calculation_errors.length > 0) {
      return json({ error: "coach_vat_rate_missing" }, 409);
    }

    const invoiceLookup = {
      coachId,
      period: context.period,
      bundleType,
    };
    const { data: existing, error: existingError } =
      await loadCoachInvoice(supabase, invoiceLookup);
    if (existingError) {
      return json(
        {
          error:
            existingError.code === "AMBIGUOUS_INVOICE_PERIOD"
              ? "ambiguous_legacy_invoice_period"
              : "existing_invoice_load_failed",
        },
        existingError.code === "AMBIGUOUS_INVOICE_PERIOD" ? 409 : 500
      );
    }
    if (existing && existing.invoice_status !== "draft") {
      return json(
        {
          error:
            existing.invoice_status === "finalized"
              ? "invoice_finalized_read_only"
              : "legacy_invoice_read_only",
        },
        409
      );
    }

    const now = new Date().toISOString();
    const payload = {
      coach_id: coachId,
      billing_mode: context.period.billingMode,
      billing_year: nullableNumber(context.period.billingYear),
      billing_quarter: nullableNumber(context.period.billingQuarter),
      billing_month: nullableNumber(context.period.billingMonth),
      bundle_key: bundle.bundle_key,
      invoice_status: "draft",
      invoice_number: normalizeString(body.invoice_number),
      invoice_date: normalizeString(body.invoice_date),
      service_period: normalizeString(body.service_period) || context.period.label,
      customer_number: normalizeString(body.customer_number),
      contact_person: normalizeString(body.contact_person),
      client_name: normalizeString(body.client_name),
      client_street: normalizeString(body.client_street),
      client_city: normalizeString(body.client_city),
      client_country: normalizeString(body.client_country),
      client_email: normalizeString(body.client_email),
      salutation: normalizeString(body.salutation),
      intro_text: normalizeString(body.intro_text),
      payment_terms: normalizeString(body.payment_terms),
      closing_text: normalizeString(body.closing_text),
      invoice_with_vat: bundle.tax_treatment === "vat",
      tax_treatment: bundle.tax_treatment,
      tax_reason: bundle.tax_reason,
      vat_rate: bundle.vat_rate,
      total_net: bundle.subtotal_net,
      vat_amount: bundle.vat_amount,
      total_gross: bundle.total_gross,
      line_items: invoiceLineItemsFromBundle(bundle),
      source_snapshot: null,
      finalized_at: null,
      finalized_by: null,
      sevdesk_invoice_id: existing?.sevdesk_invoice_id || null,
      sevdesk_invoice_number: existing?.sevdesk_invoice_number || null,
      sevdesk_synced_at: existing?.sevdesk_synced_at || null,
      updated_by: auth.member.id,
      updated_at: now,
    };

    let result;
    let saveError;
    if (existing) {
      const updateResult = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", existing.id)
        .eq("invoice_status", "draft")
        .select()
        .maybeSingle();
      result = updateResult.data;
      saveError = updateResult.error;
    } else {
      const insertResult = await supabase
        .from(TABLE_NAME)
        .insert({
          ...payload,
          created_by: auth.member.id,
          created_at: now,
        })
        .select()
        .maybeSingle();
      result = insertResult.data;
      saveError = insertResult.error;
    }

    if (saveError || !result) {
      return json(
        {
          error: saveError?.code === "23505"
            ? "draft_already_exists_reload_required"
            : "save_failed",
        },
        saveError?.code === "23505" ? 409 : 500
      );
    }

    return json({ ok: true, data: result, bundle_type: bundleType });
  } catch (err) {
    console.error("SAVE COACH INVOICE SERVER ERROR");
    return json(
      {
        error: "server_error",
        detail: "INTERNAL_ERROR",
      },
      500
    );
  }
}
