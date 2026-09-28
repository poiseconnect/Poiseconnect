import { toStoredBundleKey } from "./coachBilling.js";

function normalizeString(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeCoachInvoiceLineItems(value) {
  if (!Array.isArray(value)) return null;

  return value.map((item, index) => ({
    id: normalizeString(item?.id) || `${index + 1}`,
    pos: safeNumber(item?.pos, index + 1),
    description: normalizeString(item?.description) || "Provision",
    qty: safeNumber(item?.qty, 0),
    unit_price: safeNumber(item?.unit_price ?? item?.unit, 0),
    total: safeNumber(item?.total, 0),
  }));
}

export function buildEditableCoachInvoicePayload({
  body,
  existing,
  period,
  bundleType,
  updatedBy,
  updatedAt,
}) {
  const lineItems = normalizeCoachInvoiceLineItems(body.line_items);
  if (!lineItems) throw new TypeError("invalid_line_items");

  const taxTreatment = normalizeString(body.tax_treatment);
  if (
    taxTreatment &&
    !["vat", "reverse_charge", "review_required"].includes(taxTreatment)
  ) {
    throw new TypeError("invalid_tax_treatment");
  }

  return {
    coach_id: normalizeString(body.coach_id),
    billing_mode: period.billingMode,
    billing_year: period.billingYear,
    billing_quarter: period.billingQuarter,
    billing_month: period.billingMonth,
    bundle_key: toStoredBundleKey(bundleType),
    invoice_number: normalizeString(body.invoice_number),
    invoice_date: normalizeString(body.invoice_date),
    service_period: normalizeString(body.service_period) || period.label,
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
    invoice_with_vat: body.invoice_with_vat === true,
    tax_treatment: taxTreatment,
    tax_reason: normalizeString(body.tax_reason),
    vat_rate: safeNumber(body.vat_rate, 0),
    total_net: safeNumber(body.total_net, 0),
    vat_amount: safeNumber(body.vat_amount, 0),
    total_gross: safeNumber(body.total_gross, 0),
    line_items: lineItems,
    sevdesk_invoice_id:
      normalizeString(body.sevdesk_invoice_id) ||
      existing?.sevdesk_invoice_id ||
      null,
    sevdesk_invoice_number: existing?.sevdesk_invoice_number || null,
    sevdesk_synced_at: existing?.sevdesk_synced_at || null,
    updated_by: updatedBy,
    updated_at: updatedAt,
  };
}