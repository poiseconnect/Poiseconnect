import { buildCoachBillingPeriod, toStoredBundleKey } from "./coachBilling.js";

export function getSevdeskSyncErrorMessage(result, positions = false) {
  if (result?.error === "invalid_invoice_period") {
    return "Der gespeicherte Abrechnungszeitraum fehlt oder ist ungueltig. Bitte den Entwurf pruefen.";
  }
  if (result?.error === "invoice_period_conflict") {
    return "Leistungszeitraum und gespeicherte Periodenfelder widersprechen sich. Bitte den Entwurf pruefen.";
  }
  return positions
    ? "Die Positionen konnten nicht vollstaendig zu sevDesk uebertragen werden. Bitte vor einem erneuten Versuch pruefen."
    : "Die sevDesk-Rechnung konnte nicht aktualisiert werden. Bitte den gespeicherten Entwurf pruefen.";
}

export function buildSevdeskPeriodFields(invoice) {
  const mode = invoice.billing_mode;
  const year = Number(invoice.billing_year);
  const quarter = Number(invoice.billing_quarter);
  const month = Number(invoice.billing_month);
  if (
    !Number.isInteger(year) || year < 1000 || year > 9999 ||
    !["quartal", "monat", "jahr"].includes(mode) ||
    (mode === "quartal" && (!Number.isInteger(quarter) || quarter < 1 || quarter > 4)) ||
    (mode === "monat" && (!Number.isInteger(month) || month < 1 || month > 12))
  ) {
    throw Object.assign(new TypeError("Der gespeicherte Abrechnungszeitraum fehlt oder ist ungueltig."), {
      code: "invalid_invoice_period",
    });
  }

  const startMonth = mode === "quartal" ? (quarter - 1) * 3 + 1 : mode === "monat" ? month : 1;
  const endMonth = mode === "quartal" ? startMonth + 2 : mode === "monat" ? month : 12;
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  const startDate = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(endMonth).padStart(2, "0")}-${lastDay}`;
  const label = String(invoice.service_period || "").trim();
  const quarterLabel = /^(?:Q(\d{1,2})|(\d{1,2})\.\s*Quartal)\s+(\d{4})$/i.exec(label);
  const monthLabel = /^(\d{1,2})\/(\d{4})$/.exec(label);
  const yearLabel = /^(\d{4})$/.exec(label);
  const rangeLabel = /^(\d{2})\.(\d{2})\.(\d{4})\s*(?:-|\u2013|\u2014|bis)\s*(\d{2})\.(\d{2})\.(\d{4})$/.exec(label);
  const isoRangeLabel = /^(\d{4}-\d{2}-\d{2})\s*(?:-|\u2013|\u2014|bis)\s*(\d{4}-\d{2}-\d{2})$/.exec(label);
  const conflict =
    (quarterLabel && (mode !== "quartal" || Number(quarterLabel[1] || quarterLabel[2]) !== quarter || Number(quarterLabel[3]) !== year)) ||
    (monthLabel && (mode !== "monat" || Number(monthLabel[1]) !== month || Number(monthLabel[2]) !== year)) ||
    (yearLabel && (mode !== "jahr" || Number(yearLabel[1]) !== year)) ||
    (rangeLabel && (`${rangeLabel[3]}-${rangeLabel[2]}-${rangeLabel[1]}` !== startDate || `${rangeLabel[6]}-${rangeLabel[5]}-${rangeLabel[4]}` !== endDate)) ||
    (isoRangeLabel && (isoRangeLabel[1] !== startDate || isoRangeLabel[2] !== endDate));
  if (conflict) {
    throw Object.assign(new TypeError("Leistungszeitraum und gespeicherte Periodenfelder widersprechen sich. Bitte den Entwurf pruefen."), {
      code: "invoice_period_conflict",
    });
  }

  const start = buildCoachBillingPeriod({ billingMode: "einzeln", billingDate: startDate }).start;
  const end = buildCoachBillingPeriod({ billingMode: "einzeln", billingDate: endDate }).start;
  return {
    deliveryDate: start,
    deliveryDateUntil: new Date(end).getTime() / 1000,
    ...(mode === "quartal" ? { customerInternalNote: `${quarter}. Quartal ${year}` } : {}),
  };
}

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