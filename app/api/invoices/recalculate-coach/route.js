import { getUserFromBearer, json, supabaseAdmin } from "../../_lib/server";
import {
  jsonValuesEqual,
  loadCoachBillingContext,
  loadCoachInvoice,
} from "../_lib/coachInvoice";
import {
  applyCurrentCalculationToDraft,
  toSemanticBundleType,
} from "../../../lib/coachBilling.js";

export const dynamic = "force-dynamic";
import {
  getCoachInvoiceLinkState, isCoachInvoiceLinkBlocked, SEVDESK_LINK_CONFLICT_MESSAGE,
} from "../../../lib/coachInvoiceLink.js";
import {
  coachQuarterWorkflowUnavailableBody,
  getCoachQuarterWorkflowReadiness,
} from "../../../lib/coachQuarterWorkflowReadiness.js";

export async function POST(req) {
  try {
    const { user, error: authError } = await getUserFromBearer(req);
    if (!user) return json({ error: authError || "NO_TOKEN" }, 401);

    const supabase = supabaseAdmin();
    const { data: member, error: memberError } = await supabase
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (
      memberError ||
      !member ||
      member.active !== true ||
      member.role !== "admin"
    ) {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const readiness = await getCoachQuarterWorkflowReadiness(supabase);
    if (!readiness.ready) {
      return json(coachQuarterWorkflowUnavailableBody(readiness), 503);
    }

    const body = await req.json();
    const coachId = String(body.coach_id || "").trim();
    const bundleType =
      body.bundle_type || toSemanticBundleType(body.bundle_key);
    if (!coachId || !bundleType) {
      return json({ error: "missing_coach_or_bundle" }, 400);
    }

    const context = await loadCoachBillingContext(supabase, {
      coachId,
      periodInput: {
        billingMode: body.billing_mode,
        billingYear: body.billing_year,
        billingQuarter: body.billing_quarter,
        billingMonth: body.billing_month,
        billingDate: body.billing_date,
      },
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
      return json(
        {
          error: "billing_calculation_invalid",
          calculation_errors: bundle.calculation_errors,
        },
        409
      );
    }

    const { data: invoice, error: invoiceError } = await loadCoachInvoice(
      supabase,
      {
        coachId,
        period: context.period,
        bundleType,
      }
    );
    if (invoiceError) {
      return json(
        {
          error:
            invoiceError.code === "AMBIGUOUS_INVOICE_PERIOD"
              ? "ambiguous_legacy_invoice_period"
              : "invoice_load_failed",
        },
        invoiceError.code === "AMBIGUOUS_INVOICE_PERIOD" ? 409 : 500
      );
    }
    if (!invoice) return json({ error: "saved_draft_not_found" }, 404);
    let linkState;
    try {
      linkState = await getCoachInvoiceLinkState(supabase, invoice.id);
    } catch {
      console.error("coach_invoice_recalculate_blocked", { code: "invoice_link_check_unavailable" });
      return json({ error: "invoice_link_check_unavailable" }, 503);
    }
    if (isCoachInvoiceLinkBlocked(linkState)) {
      console.error("coach_invoice_recalculate_blocked", { code: "sevdesk_invoice_link_conflict" });
      return json({ error: "sevdesk_invoice_link_conflict", message: SEVDESK_LINK_CONFLICT_MESSAGE }, 409);
    }
    if (
      !body.expected_updated_at ||
      body.expected_updated_at !== invoice.updated_at
    ) {
      return json({ error: "invoice_concurrent_update" }, 409);
    }
    if (invoice.sevdesk_send_status || invoice.sevdesk_invoice_id) {
      return json({ error: "invoice_send_workflow_locked" }, 409);
    }

    let releaseVersion = null;
    if (context.period.billingMode === "quartal") {
      const { data: release, error: releaseError } = await supabase
        .from("coach_quarter_releases")
        .select("release_version, release_status, snapshot")
        .eq("coach_id", coachId)
        .eq("billing_year", context.period.billingYear)
        .eq("billing_quarter", context.period.billingQuarter)
        .maybeSingle();
      if (releaseError) return json({ error: "coach_quarter_release_load_failed" }, 500);
      if (!release || release.release_status !== "released") {
        return json({ error: "coach_quarter_release_required" }, 409);
      }
      const { data: currentSnapshot, error: snapshotError } = await supabase.rpc(
        "coach_quarter_snapshot",
        {
          p_coach_id: coachId,
          p_billing_year: context.period.billingYear,
          p_billing_quarter: context.period.billingQuarter,
        }
      );
      if (snapshotError) return json({ error: "coach_quarter_snapshot_load_failed" }, 500);
      if (!jsonValuesEqual(currentSnapshot, release.snapshot)) {
        return json({ error: "coach_quarter_release_stale" }, 409);
      }
      releaseVersion = release.release_version;
    }

    const recalculated = applyCurrentCalculationToDraft(invoice, bundle);
    const now = new Date().toISOString();
    let updateQuery = supabase
      .from("coach_invoices")
      .update({
        line_items: recalculated.line_items,
        total_net: recalculated.total_net,
        vat_amount: recalculated.vat_amount,
        total_gross: recalculated.total_gross,
        invoice_with_vat: recalculated.invoice_with_vat,
        tax_treatment: recalculated.tax_treatment,
        tax_reason: recalculated.tax_reason,
        vat_rate: recalculated.vat_rate,
        ...(releaseVersion !== null
          ? { coach_quarter_release_version: releaseVersion }
          : {}),
        updated_at: now,
        updated_by: member.id,
      })
      .eq("id", invoice.id)
      .eq("updated_at", body.expected_updated_at)
      .is("sevdesk_invoice_id", null)
      .is("sevdesk_send_status", null);
    const { data: updated, error: updateError } = await updateQuery.select("*").maybeSingle();

    if (updateError) return json({ error: "recalculation_save_failed" }, 500);
    if (!updated) return json({ error: "invoice_concurrent_update" }, 409);

    return json({
      ok: true,
      invoice: updated,
      tax_review_required: recalculated.tax_treatment === "review_required",
    });
  } catch (error) {
    return json(
      { error: "invalid_billing_period_or_server_error" },
      error instanceof TypeError ? 400 : 500
    );
  }
}
