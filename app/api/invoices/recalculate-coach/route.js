import { getUserFromBearer, json, supabaseAdmin } from "../../_lib/server";
import {
  loadCoachBillingContext,
  loadCoachInvoice,
} from "../_lib/coachInvoice";
import {
  applyCurrentCalculationToDraft,
  toSemanticBundleType,
} from "../../../lib/coachBilling.js";

export const dynamic = "force-dynamic";

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
          error: "coach_vat_rate_missing",
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

    const recalculated = applyCurrentCalculationToDraft(invoice, bundle);
    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
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
        updated_at: now,
        updated_by: member.id,
      })
      .eq("id", invoice.id)
      .select("*")
      .single();

    if (updateError) return json({ error: "recalculation_save_failed" }, 500);

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