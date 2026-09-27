export const dynamic = "force-dynamic";

import { getUserFromBearer, json, supabaseAdmin } from "../../_lib/server";
import {
  loadCoachBillingContext,
  loadCoachInvoice,
} from "../_lib/coachInvoice";
import {
  getCoachInvoiceState,
  getCoachInvoiceView,
  resolveCoachInvoiceTax,
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
    const state = getCoachInvoiceState(invoice);
    const tax = resolveCoachInvoiceTax(context.coachTaxProfile);
    const view = getCoachInvoiceView({
      invoice,
      calculatedBundle: bundle,
    });
    const storedSessionCount = invoice
      ? Number(
          invoice.source_snapshot?.session_count ??
            storedLineItems(invoice.line_items).reduce(
              (sum, item) => sum + item.qty,
              0
            )
        )
      : null;
    const currentInvoiceTax = invoice && state !== "draft";
    const currentLineItems = bundle
      ? view.line_items
      : state === "draft"
        ? []
        : storedLineItems(invoice?.line_items);

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
      invoice_status: invoice?.invoice_status ?? null,
      invoice_state: state,
      read_only: state !== "draft",
      bundle_type: bundleType,
      bundle_key: invoice?.bundle_key || bundle?.bundle_key || null,
      invoice_with_vat: view.invoice_with_vat,
      tax_treatment: currentInvoiceTax
        ? view.tax_treatment
        : view.tax_treatment || tax.tax_treatment,
      tax_reason: currentInvoiceTax ? view.tax_reason : view.tax_reason || tax.tax_reason,
      vat_rate: view.vat_rate,
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
      lineItems: currentLineItems,
      totals: {
        net: view.total_net,
        vat: view.vat_amount,
        gross: view.total_gross,
      },
      session_count: bundle?.session_count ?? null,
      calculation_errors: bundle?.calculation_errors || [],
      finalization_blocked:
        Boolean(bundle?.calculation_errors?.length) ||
        (bundle ? bundle.tax_treatment === "review_required" : false),
      current_session_ids: bundle?.session_ids || [],
      current_session_count: bundle?.session_count ?? 0,
      stored_session_count: state === "draft" ? null : storedSessionCount,
      finalized_at: invoice?.finalized_at || null,
    });
  } catch (error) {
    return json(
      { error: "invalid_billing_period_or_server_error" },
      error instanceof TypeError ? 400 : 500
    );
  }
}