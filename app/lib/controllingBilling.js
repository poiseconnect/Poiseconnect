import { calculateSessionCommission } from "./coachBilling.js";

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