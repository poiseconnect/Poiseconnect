import { calculateSessionCommission } from "./coachBilling.js";

export function createProvisionErrorCounts() {
  return {
    invalid_session_price: 0,
    coach_vat_rate_missing: 0,
  };
}

export function addProvisionResult(summary, result) {
  if (!result?.error) {
    summary.provision += Number(result?.commissionNet || 0);
    return;
  }

  summary.provision_calculation_incomplete = true;
  summary.provision_errors[result.error] =
    Number(summary.provision_errors[result.error] || 0) + 1;
}

export function mergeProvisionErrorCounts(target, source = {}) {
  for (const [code, count] of Object.entries(source)) {
    target[code] = Number(target[code] || 0) + Number(count || 0);
  }
}

export function getProvisionWarnings(errors = {}) {
  const invalidPriceCount = Number(errors.invalid_session_price || 0);
  const missingVatRateCount = Number(errors.coach_vat_rate_missing || 0);
  const warnings = [];

  if (invalidPriceCount > 0) {
    warnings.push(
      `${invalidPriceCount} ${invalidPriceCount === 1 ? "Sitzung" : "Sitzungen"} ohne gültigen Preis`
    );
  }
  if (missingVatRateCount > 0) {
    warnings.push(
      `${missingVatRateCount} ${missingVatRateCount === 1 ? "Sitzung" : "Sitzungen"}: USt-Satz fehlt`
    );
  }

  return warnings;
}

export function buildCoachInvoiceSettingsById(settings = []) {
  return Object.fromEntries(
    settings
      .filter((setting) => setting?.therapist_id)
      .map((setting) => [String(setting.therapist_id), setting])
  );
}

export function calculateControllingSessionCommission(
  session,
  coachInvoiceSettingsById = {}
) {
  const settings = coachInvoiceSettingsById[String(session?.therapist_id || "")];
  const clientWithVat =
    session?.anfragen?.invoice_with_vat === true ||
    session?.invoice_with_vat === true;

  return calculateSessionCommission({
    price: session?.price,
    clientWithVat,
    coachVatRate: settings?.default_vat_rate,
  });
}