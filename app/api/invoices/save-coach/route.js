export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import {
  loadCoachBillingContext,
  jsonValuesEqual,
  loadCoachInvoice,
  normalizeBillingPeriod,
} from "../_lib/coachInvoice";
import {
  toSemanticBundleType,
} from "../../../lib/coachBilling.js";
import { buildEditableCoachInvoicePayload } from "../../../lib/coachInvoiceDraft.js";
import {
  getCoachInvoiceLinkState, isCoachInvoiceLinkBlocked, SEVDESK_LINK_CONFLICT_MESSAGE,
} from "../../../lib/coachInvoiceLink.js";
import {
  coachQuarterWorkflowUnavailableBody,
  getCoachQuarterWorkflowReadiness,
} from "../../../lib/coachQuarterWorkflowReadiness.js";

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

    const readiness = await getCoachQuarterWorkflowReadiness(supabase);
    if (!readiness.ready) {
      return json(coachQuarterWorkflowUnavailableBody(readiness), 503);
    }

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

    const period = normalizeBillingPeriod({
      billingMode,
      billingYear,
      billingQuarter,
      billingMonth,
      billingDate: body.billing_date,
    });
    if (!period.invoiceSupported) {
      return json({ error: "single_day_invoice_not_supported" }, 400);
    }

    const billingContext = await loadCoachBillingContext(supabase, {
      coachId,
      periodInput: {
        billingMode,
        billingYear,
        billingQuarter,
        billingMonth,
        billingDate: body.billing_date,
      },
    });
    if (billingContext.error) {
      return json({ error: "billing_context_load_failed" }, 500);
    }
    const currentBundle = billingContext.bundles.find(
      (candidate) => candidate.bundle_type === bundleType
    );
    if (!currentBundle) {
      return json({ error: "no_current_sessions_for_bundle" }, 409);
    }
    if (currentBundle.calculation_errors.length > 0) {
      return json({
        error: "billing_calculation_invalid",
        calculation_errors: currentBundle.calculation_errors,
      }, 409);
    }

    const invoiceLookup = {
      coachId,
      period,
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
    if (existing) {
      let linkState;
      try {
        linkState = await getCoachInvoiceLinkState(supabase, existing.id);
      } catch {
        console.error("coach_invoice_save_blocked", { code: "invoice_link_check_unavailable" });
        return json({ error: "invoice_link_check_unavailable" }, 503);
      }
      if (isCoachInvoiceLinkBlocked(linkState)) {
        console.error("coach_invoice_save_blocked", { code: "sevdesk_invoice_link_conflict" });
        return json({ error: "sevdesk_invoice_link_conflict", message: SEVDESK_LINK_CONFLICT_MESSAGE }, 409);
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, "sevdesk_invoice_id") &&
        normalizeString(body.sevdesk_invoice_id) !== normalizeString(existing?.sevdesk_invoice_id)) {
      console.error("coach_invoice_save_blocked", { code: "sevdesk_invoice_id_readonly" });
      return json({ error: "sevdesk_invoice_id_readonly" }, 409);
    }
    if (existing?.sevdesk_send_status || existing?.sevdesk_invoice_id) {
      return json({ error: "invoice_send_workflow_locked" }, 409);
    }

    let quarterReleaseVersion = null;
    if (period.billingMode === "quartal") {
      const { data: release, error: releaseError } = await supabase
        .from("coach_quarter_releases")
        .select("release_version, release_status, snapshot")
        .eq("coach_id", coachId)
        .eq("billing_year", period.billingYear)
        .eq("billing_quarter", period.billingQuarter)
        .maybeSingle();
      if (releaseError) return json({ error: "coach_quarter_release_load_failed" }, 500);
      if (!release || release.release_status !== "released") {
        return json({ error: "coach_quarter_release_required" }, 409);
      }
      const { data: currentSnapshot, error: snapshotError } = await supabase.rpc(
        "coach_quarter_snapshot",
        {
          p_coach_id: coachId,
          p_billing_year: period.billingYear,
          p_billing_quarter: period.billingQuarter,
        }
      );
      if (snapshotError) return json({ error: "coach_quarter_snapshot_load_failed" }, 500);
      if (!jsonValuesEqual(currentSnapshot, release.snapshot)) {
        return json({ error: "coach_quarter_release_stale" }, 409);
      }
      quarterReleaseVersion = release.release_version;
    }

    const now = new Date().toISOString();
    let payload;
    try {
      payload = buildEditableCoachInvoicePayload({
        body: { ...body, coach_id: coachId },
        existing,
        period,
        bundleType,
        updatedBy: auth.member.id,
        updatedAt: now,
      });
      if (quarterReleaseVersion !== null) {
        payload.coach_quarter_release_version = quarterReleaseVersion;
        payload.sevdesk_send_error_code = null;
      }
    } catch (error) {
      return json({ error: error.message || "invalid_invoice_data" }, 400);
    }

    let result;
    let saveError;
    if (existing) {
      if (
        !body.expected_updated_at ||
        body.expected_updated_at !== existing.updated_at
      ) {
        return json({ error: "invoice_concurrent_update" }, 409);
      }
      let updateQuery = supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq("id", existing.id)
        .eq("updated_at", body.expected_updated_at);
      if (Object.prototype.hasOwnProperty.call(existing, "sevdesk_send_status")) {
        updateQuery = updateQuery.is("sevdesk_send_status", null);
      }

      const updateResult = await updateQuery.select().maybeSingle();
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
      if (saveError?.message?.includes("sevdesk_invoice_link_conflict")) {
        console.error("coach_invoice_save_blocked", { code: "sevdesk_invoice_link_conflict" });
        return json({ error: "sevdesk_invoice_link_conflict", message: SEVDESK_LINK_CONFLICT_MESSAGE }, 409);
      }
      return json(
        {
          error: saveError?.code === "23505"
            ? "draft_already_exists_reload_required"
            : existing && !saveError
              ? "invoice_concurrent_update"
              : "save_failed",
        },
        saveError?.code === "23505" || (existing && !saveError) ? 409 : 500
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
