import { getUserFromBearer, json, supabaseAdmin } from "../../_lib/server";
import {
  loadCoachBillingContext,
  loadCoachInvoice,
  invoiceLineItemsFromBundle,
} from "../_lib/coachInvoice";
import {
  getCoachInvoiceFinalizationAction,
  serializeCoachInvoiceSnapshot,
  toSemanticBundleType,
} from "../../../lib/coachBilling.js";

export const dynamic = "force-dynamic";

function generatedInvoiceNumber(bundleKey, billingYear) {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `POISE-${bundleKey}-${billingYear || new Date().getFullYear()}-${suffix}`;
}

function isUniqueViolation(error) {
  return error?.code === "23505";
}

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

    if (memberError || !member || member.active !== true || member.role !== "admin") {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const body = await req.json();
    const coachId = String(body.coach_id || "").trim();
    const bundleType =
      body.bundle_type || toSemanticBundleType(body.bundle_key);
    if (!coachId || !bundleType) {
      return json({ error: "missing_coach_or_bundle" }, 400);
    }

    const periodInput = {
      billingMode: body.billing_mode,
      billingYear: body.billing_year,
      billingQuarter: body.billing_quarter,
      billingMonth: body.billing_month,
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
      return json(
        {
          error: "coach_vat_rate_missing",
          calculation_errors: bundle.calculation_errors,
        },
        409
      );
    }
    if (bundle.tax_treatment === "review_required") {
      return json(
        {
          error: "tax_review_required",
          tax_reason: bundle.tax_reason,
        },
        409
      );
    }

    const invoiceLookup = {
      coachId,
      period: context.period,
      bundleType,
    };
    const { data: existingInvoice, error: invoiceError } =
      await loadCoachInvoice(supabase, invoiceLookup);
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

    const finalizationAction = getCoachInvoiceFinalizationAction(existingInvoice);
    if (finalizationAction === "return_final") {
      return json({
        ok: true,
        already_finalized: true,
        invoice: existingInvoice,
      });
    }
    if (finalizationAction === "legacy_read_only") {
      return json({ error: "legacy_invoice_read_only" }, 409);
    }

    const now = new Date().toISOString();
    const invoiceNumber =
      existingInvoice?.invoice_number ||
      String(body.invoice_number || "").trim() ||
      generatedInvoiceNumber(bundle.bundle_key, context.period.billingYear);
    const taxSnapshot = serializeCoachInvoiceSnapshot({
      coachId,
      billingPeriod: context.period,
      bundle,
      coachTaxProfile: context.coachTaxProfile,
    });
    const sourceSnapshot = {
      ...taxSnapshot,
      invoice_number: invoiceNumber,
      invoice_date: existingInvoice?.invoice_date || body.invoice_date || now.slice(0, 10),
    };
    const invoicePatch = {
      invoice_status: "finalized",
      bundle_key: bundle.bundle_key,
      invoice_number: invoiceNumber,
      invoice_date: existingInvoice?.invoice_date || body.invoice_date || now.slice(0, 10),
      service_period: existingInvoice?.service_period || context.period.label,
      invoice_with_vat: bundle.tax_treatment === "vat",
      tax_treatment: bundle.tax_treatment,
      tax_reason: bundle.tax_reason,
      vat_rate: bundle.vat_rate,
      total_net: bundle.subtotal_net,
      vat_amount: bundle.vat_amount,
      total_gross: bundle.total_gross,
      line_items: invoiceLineItemsFromBundle(bundle),
      source_snapshot: sourceSnapshot,
      finalized_at: now,
      finalized_by: member.id,
      updated_at: now,
      updated_by: member.id,
    };

    if (existingInvoice) {
      const { data: finalizedInvoice, error: finalizeError } = await supabase
        .from("coach_invoices")
        .update(invoicePatch)
        .eq("id", existingInvoice.id)
        .eq("invoice_status", "draft")
        .select("*")
        .maybeSingle();

      if (!finalizeError && finalizedInvoice) {
        return json({ ok: true, already_finalized: false, invoice: finalizedInvoice });
      }

      const { data: latestInvoice, error: latestError } =
        await loadCoachInvoice(supabase, invoiceLookup);
      if (!latestError && latestInvoice?.invoice_status === "finalized") {
        return json({ ok: true, already_finalized: true, invoice: latestInvoice });
      }
      return json({ error: "invoice_finalize_race_or_failure" }, 409);
    }

    const insertPayload = {
      ...invoicePatch,
      coach_id: coachId,
      billing_mode: context.period.billingMode,
      billing_year: context.period.billingYear
        ? Number(context.period.billingYear)
        : null,
      billing_quarter: context.period.billingQuarter
        ? Number(context.period.billingQuarter)
        : null,
      billing_month: context.period.billingMonth
        ? Number(context.period.billingMonth)
        : null,
      created_by: member.id,
      created_at: now,
    };
    const { data: finalizedInvoice, error: insertError } = await supabase
      .from("coach_invoices")
      .insert(insertPayload)
      .select("*")
      .maybeSingle();

    if (!insertError && finalizedInvoice) {
      return json({ ok: true, already_finalized: false, invoice: finalizedInvoice });
    }

    if (isUniqueViolation(insertError)) {
      const { data: racedInvoice, error: racedError } =
        await loadCoachInvoice(supabase, invoiceLookup);
      if (!racedError && racedInvoice?.invoice_status === "finalized") {
        return json({ ok: true, already_finalized: true, invoice: racedInvoice });
      }
      if (!racedError && racedInvoice?.invoice_status === "draft") {
        const { data: racedFinal, error: racedFinalizeError } = await supabase
          .from("coach_invoices")
          .update(invoicePatch)
          .eq("id", racedInvoice.id)
          .eq("invoice_status", "draft")
          .select("*")
          .maybeSingle();
        if (!racedFinalizeError && racedFinal) {
          return json({ ok: true, already_finalized: false, invoice: racedFinal });
        }
        const { data: latestFinal, error: latestFinalError } =
          await loadCoachInvoice(supabase, invoiceLookup);
        if (!latestFinalError && latestFinal?.invoice_status === "finalized") {
          return json({ ok: true, already_finalized: true, invoice: latestFinal });
        }
      }
    }

    return json({ error: "invoice_finalize_failed" }, 500);
  } catch (error) {
    return json(
      { error: "invalid_billing_period_or_server_error" },
      error instanceof TypeError ? 400 : 500
    );
  }
}