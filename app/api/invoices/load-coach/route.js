export const dynamic = "force-dynamic";

import { getUserFromBearer, json, supabaseAdmin } from "../../_lib/server";
import {
  loadCoachBillingContext,
  loadCoachInvoice,
} from "../_lib/coachInvoice";
import {
  getCoachInvoiceDraftView,
  toSemanticBundleType,
} from "../../../lib/coachBilling.js";

const POISE_ADMIN_SETTINGS = {
  company_name: "Poise by Linda Leinweber GmbH",
  address: "Hamberg 21\n4813 Altmünster\nÖsterreich",
  iban: "AT04 3451 0000 0206 1224",
  bic: "RZOOAT2L510",
  vat_number: "ATU78817327",
  tax_number: "53 317 6657",
};

function storedLineItems(items = []) {
  return items.map((item, index) => ({
    id: item.id || `${index + 1}`,
    description: item.description || "Provision",
    qty: Number(item.qty || 0),
    unit_price: Number(item.unit_price || 0),
    unit: Number(item.unit_price || 0),
    total: Number(item.total || 0),
  }));
}

export async function GET(req) {
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

    const params = new URL(req.url).searchParams;
    const coachId = String(params.get("coachId") || "").trim();
    const bundleType =
      toSemanticBundleType(params.get("bundleKey")) ||
      params.get("bundleType");
    if (!coachId || !bundleType) {
      return json({ error: "missing_coach_or_bundle" }, 400);
    }

    const periodInput = {
      billingMode: params.get("billingMode"),
      billingYear: params.get("billingYear"),
      billingQuarter: params.get("billingQuarter"),
      billingMonth: params.get("billingMonth"),
      billingDate: params.get("billingDate"),
    };
    const context = await loadCoachBillingContext(supabase, {
      coachId,
      periodInput,
    });
    if (context.error) {
      const status = context.error.code === "PGRST116" ? 404 : 500;
      return json({ error: "billing_context_load_failed" }, status);
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
              : invoiceError.code === "UNSUPPORTED_INVOICE_PERIOD"
                ? "single_day_invoice_not_supported"
                : "invoice_load_failed",
        },
        invoiceError.code === "AMBIGUOUS_INVOICE_PERIOD" ||
          invoiceError.code === "UNSUPPORTED_INVOICE_PERIOD"
          ? 409
          : 500
      );
    }

    const bundle = context.bundles.find(
      (candidate) => candidate.bundle_type === bundleType
    ) || null;
    const view = getCoachInvoiceDraftView({
      invoice,
      calculatedBundle: bundle,
    });
    const primaryDraft = view.primary_draft || {};
    const primaryLineItems = storedLineItems(primaryDraft.line_items);
    const currentCalculation = view.current_calculation;
    const storedSessionCount = invoice
      ? storedLineItems(invoice.line_items).reduce(
          (sum, item) => sum + item.qty,
          0
        )
      : null;

    return json({
      coach: {
        id: context.coach.id,
        name: context.coach.profile_name || "Coach",
        email: context.coach.email || "",
      },
      poiseSettings: POISE_ADMIN_SETTINGS,
      coachInvoiceSettings: context.coachTaxProfile,
      from_saved_invoice: Boolean(invoice),
      invoice_id: invoice?.id || null,
      invoice_state: invoice ? "saved_draft" : "automatic_draft",
      bundle_type: bundleType,
      bundle_key: invoice?.bundle_key || bundle?.bundle_key || null,
      invoice_with_vat: primaryDraft.invoice_with_vat === true,
      tax_treatment: primaryDraft.tax_treatment || null,
      tax_reason: primaryDraft.tax_reason || null,
      vat_rate: Number(primaryDraft.vat_rate || 0),
      invoice_number: invoice?.invoice_number || "",
      invoice_date: invoice?.invoice_date || "",
      service_period: invoice?.service_period || context.period.label,
      customer_number: invoice?.customer_number || "",
      contact_person: invoice?.contact_person || "",
      salutation:
        invoice?.salutation || "Sehr geehrte Damen und Herren,",
      intro_text:
        invoice?.intro_text ||
        "Für unsere Unterstützung stellen wir wie vereinbart in Rechnung:",
      payment_terms:
        invoice?.payment_terms ||
        "Zahlungsbedingungen: Zahlung innerhalb von 14 Tagen ab Rechnungseingang ohne Abzüge.",
      closing_text:
        invoice?.closing_text ||
        "Herzlichen Dank für Dein Engagement und die angenehme Zusammenarbeit!\n\nLiebe Grüße\n\nSebastian Kickinger\nPoise by Linda Leinweber GmbH",
      client_name:
        invoice?.client_name ||
        context.coachTaxProfile.company_name ||
        context.coach.profile_name ||
        "Coach",
      client_street: invoice?.client_street || "",
      client_city: invoice?.client_city || "",
      client_country: invoice?.client_country || "",
      client_email: invoice?.client_email || context.coach.email || "",
      sevdesk_invoice_id: invoice?.sevdesk_invoice_id || "",
      lineItems: primaryLineItems,
      totals: {
        net: Number(primaryDraft.total_net || 0),
        vat: Number(primaryDraft.vat_amount || 0),
        gross: Number(primaryDraft.total_gross || 0),
      },
      saved_draft: view.saved_draft
        ? {
            lineItems: storedLineItems(view.saved_draft.line_items),
            totals: {
              net: view.saved_draft.total_net,
              vat: view.saved_draft.vat_amount,
              gross: view.saved_draft.total_gross,
            },
            invoice_with_vat: view.saved_draft.invoice_with_vat,
            tax_treatment: view.saved_draft.tax_treatment,
            tax_reason: view.saved_draft.tax_reason,
            vat_rate: view.saved_draft.vat_rate,
          }
        : null,
      current_calculation: currentCalculation
        ? {
            ...currentCalculation,
            lineItems: storedLineItems(currentCalculation.line_items),
            totals: {
              net: currentCalculation.total_net,
              vat: currentCalculation.vat_amount,
              gross: currentCalculation.total_gross,
            },
          }
        : null,
      has_calculation_difference: view.has_calculation_difference,
      calculation_errors: bundle?.calculation_errors || [],
      downstream_processing_blocked:
        !primaryDraft.tax_treatment ||
        primaryDraft.tax_treatment === "review_required",
      current_session_ids: bundle?.session_ids || [],
      current_session_count: bundle?.session_count ?? 0,
      stored_session_count: storedSessionCount,
    });
  } catch (error) {
    return json(
      { error: "invalid_billing_period_or_server_error" },
      error instanceof TypeError ? 400 : 500
    );
  }
}