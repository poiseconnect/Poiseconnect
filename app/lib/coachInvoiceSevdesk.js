import { buildSevdeskPeriodFields } from "./coachInvoiceDraft.js";
import { isCoachInvoiceLinkBlocked } from "./coachInvoiceLink.js";
import {
  resolveCoachInvoiceTax,
  toSemanticBundleType,
} from "./coachBilling.js";

const TAX_TREATMENTS = new Set(["vat", "reverse_charge"]);
const TAX_TYPES = new Set(["default", "eu", "noteu", "ss"]);

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? roundCurrency(number) : null;
}

export function loadCoachInvoiceAutomationConfig(env = process.env) {
  if (env.SEVDESK_COACH_INVOICE_LIVE_ENABLED !== "true") {
    return { enabled: false, reason: "live_disabled" };
  }

  if (env.SEVDESK_COACH_INVOICE_API_SCHEMA_CONFIRMED !== "true") {
    return { enabled: false, reason: "api_schema_unconfirmed" };
  }

  const testCoachId = String(env.SEVDESK_COACH_INVOICE_TEST_COACH_ID || "").trim();
  if (!testCoachId) {
    return { enabled: false, reason: "test_coach_not_configured" };
  }

  let taxConfig;
  try {
    taxConfig = JSON.parse(env.SEVDESK_COACH_INVOICE_TAX_CONFIG || "null");
  } catch {
    return { enabled: false, reason: "tax_config_invalid" };
  }

  if (
    !taxConfig ||
    taxConfig.confirmed !== true ||
    !["1.0", "2.0"].includes(taxConfig.systemVersion) ||
    !taxConfig.treatments ||
    !taxConfig.countryMappings ||
    !Array.isArray(taxConfig.coachContactMappings) ||
    ![...TAX_TREATMENTS].every((treatment) => {
      const rule = taxConfig.treatments[treatment];
      if (!rule || !Number.isFinite(Number(rule.positionTaxRate)) || !rule.taxText) return false;
      if (taxConfig.systemVersion === "2.0") {
        return Boolean(
          rule.taxRule &&
            String(rule.taxRule.id || "").trim() &&
            rule.taxRule.objectName === "TaxRule" &&
            TAX_TYPES.has(rule.legacyTaxType)
        );
      }
      return TAX_TYPES.has(rule.taxType) && !rule.taxRule;
    }) ||
    !Object.values(taxConfig.countryMappings).every((country) =>
      country && String(country.id || "").trim() &&
      Array.isArray(country.aliases) && country.aliases.length > 0
    ) ||
    !taxConfig.contactPerson ||
    taxConfig.contactPerson.objectName !== "SevUser" ||
    !String(taxConfig.contactPerson.id || "").trim()
  ) {
    return { enabled: false, reason: "tax_config_unconfirmed" };
  }

  return { enabled: true, taxConfig, testCoachId };
}

export function validateCoachInvoiceDraft(invoice, coach, config, taxProfile = coach) {
  if (!config?.enabled) {
    return { error: "sevdesk_live_workflow_blocked", reason: config?.reason || "configuration_missing" };
  }
  if (!invoice || !invoice.id || !invoice.coach_id) {
    return { error: "saved_draft_required" };
  }
  if (invoice.sevdesk_invoice_id && !invoice.sevdesk_send_status) {
    return { error: "manually_linked_invoice_blocked" };
  }
  if (invoice.sevdesk_send_status === "finalized") {
    return { error: "invoice_already_finalized" };
  }
  if (["creating", "creation_unknown", "sending", "send_unknown", "sent"].includes(invoice.sevdesk_send_status)) {
    return { error: "manual_reconciliation_required" };
  }
  if (!coach?.id || String(invoice.coach_id) !== String(coach.id)) {
    return { error: "coach_assignment_mismatch" };
  }
  if (!coach.sevdesk_contact_id) return { error: "sevdesk_contact_missing" };
  const contactMapping = config.taxConfig.coachContactMappings.find(
    (mapping) => String(mapping.coachId) === String(coach.id) &&
      String(mapping.contactId) === String(coach.sevdesk_contact_id) &&
      mapping.addressConfirmed === true
  );
  if (!contactMapping) return { error: "sevdesk_contact_mapping_unconfirmed" };
  const countryMapping = config.taxConfig.countryMappings?.[coach.business_country_code];
  if (!countryMapping || String(countryMapping.id) !== String(coach.sevdesk_country_id)) {
    return { error: "sevdesk_contact_country_unverified" };
  }
  if (!countryMapping.aliases.some((alias) => normalizeCountry(alias) === normalizeCountry(invoice.client_country))) {
    return { error: "recipient_country_mismatch" };
  }
  if (!invoice.client_email || !coach.email || normalizeEmail(invoice.client_email) !== normalizeEmail(coach.email)) {
    return { error: "coach_email_mismatch" };
  }
  if (!invoice.client_name || !invoice.client_street || !invoice.client_city || !invoice.client_country) {
    return { error: "recipient_address_incomplete" };
  }
  if (!isValidDateOnly(invoice.invoice_date)) {
    return { error: "invoice_date_invalid" };
  }
  if (!invoice.service_period || !invoice.payment_terms || !invoice.intro_text) {
    return { error: "invoice_text_or_period_missing" };
  }
  if (!Array.isArray(invoice.line_items) || invoice.line_items.length === 0) {
    return { error: "invoice_positions_missing" };
  }
  if (!TAX_TREATMENTS.has(invoice.tax_treatment)) {
    return { error: "tax_treatment_unconfirmed" };
  }

  const bundleType = toSemanticBundleType(invoice.bundle_key);
  if (!bundleType) return { error: "invoice_bundle_missing" };
  const expectedTax = resolveCoachInvoiceTax({
    coachTaxProfile: taxProfile,
    bundleType,
  });
  if (
    expectedTax.tax_treatment === "review_required" ||
    expectedTax.tax_treatment !== invoice.tax_treatment ||
    expectedTax.tax_reason !== invoice.tax_reason ||
    invoice.invoice_with_vat !== (expectedTax.tax_treatment === "vat") ||
    Number(invoice.vat_rate) !== Number(expectedTax.vat_rate)
  ) {
    return { error: "tax_treatment_does_not_match_coach_draft" };
  }
  if (
    invoice.tax_treatment === "reverse_charge" &&
    (taxProfile?.business_country_code !== "DE" ||
      !String(taxProfile?.vat_number || "").trim() ||
      !taxProfile?.uid_confirmed_at ||
      !taxProfile?.uid_confirmed_by)
  ) {
    return { error: "reverse_charge_uid_unconfirmed" };
  }

  const taxRule = config.taxConfig.treatments[invoice.tax_treatment];
  const expectedRate = invoice.tax_treatment === "vat" ? Number(invoice.vat_rate) : 0;
  if (
    !Number.isFinite(expectedRate) ||
    (expectedRate <= 0 && invoice.tax_treatment === "vat") ||
    Number(taxRule.positionTaxRate) !== expectedRate
  ) {
    return { error: "tax_rate_mapping_mismatch" };
  }

  let netTotal = 0;
  let lineVatTotal = 0;
  for (const item of invoice.line_items) {
    const quantity = Number(item.qty);
    const rawUnitPrice = Number(item.unit_price ?? item.unit);
    const unitPrice = normalizeMoney(rawUnitPrice);
    const lineTotal = normalizeMoney(item.total);
    if (
      !Number.isFinite(quantity) || quantity <= 0 ||
      unitPrice === null || unitPrice < 0 || rawUnitPrice !== unitPrice ||
      lineTotal === null ||
      lineTotal !== roundCurrency(quantity * unitPrice)
    ) {
      return { error: "invoice_position_total_mismatch" };
    }
    netTotal += lineTotal;
    if (invoice.tax_treatment === "vat") {
      lineVatTotal += roundCurrency(lineTotal * expectedRate / 100);
    }
  }

  const expectedNet = normalizeMoney(invoice.total_net);
  const expectedVat = normalizeMoney(invoice.vat_amount);
  const expectedGross = normalizeMoney(invoice.total_gross);
  const calculatedNet = roundCurrency(netTotal);
  const calculatedVat = invoice.tax_treatment === "vat"
    ? roundCurrency(lineVatTotal)
    : 0;
  if (
    expectedNet !== calculatedNet ||
    expectedVat !== calculatedVat ||
    expectedGross !== roundCurrency(calculatedNet + calculatedVat)
  ) {
    return { error: "invoice_totals_mismatch" };
  }

  let periodFields;
  try {
    periodFields = buildSevdeskPeriodFields(invoice);
  } catch {
    return { error: "invoice_period_invalid" };
  }
  const serviceStartDate = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Vienna",
  }).format(new Date(periodFields.deliveryDate));
  if (invoice.invoice_date < serviceStartDate) {
    return { error: "invoice_date_before_service_period" };
  }

  return { error: null, taxRule, periodFields };
}

export function buildSevdeskCoachInvoicePayload(invoice, coach, config) {
  const validation = validateCoachInvoiceDraft(invoice, coach, config, coach);
  if (validation.error) {
    throw Object.assign(new Error(validation.error), { code: validation.error });
  }

  const taxFields = config.taxConfig.systemVersion === "2.0"
    ? { taxRule: validation.taxRule.taxRule, taxType: validation.taxRule.legacyTaxType }
    : { taxType: validation.taxRule.taxType };
  const address = [
    invoice.client_name,
    invoice.client_street,
    invoice.client_city,
    invoice.client_country,
  ].join("\n");

  return {
    invoice: {
      invoiceDate: invoice.invoice_date,
      contact: { id: String(coach.sevdesk_contact_id), objectName: "Contact" },
      address,
      discount: 0,
      status: "100",
      addressCountry: { id: String(coach.sevdesk_country_id), objectName: "StaticCountry" },
      contactPerson: config.taxConfig.contactPerson,
      taxRate: 0,
      ...taxFields,
      taxText: validation.taxRule.taxText,
      invoiceType: "RE",
      currency: "EUR",
      mapAll: true,
      objectName: "Invoice",
      header: `Provision ${invoice.service_period}`,
      headText: [invoice.salutation, invoice.intro_text].filter(Boolean).join("\n\n"),
      footText: [invoice.payment_terms, invoice.closing_text].filter(Boolean).join("\n\n"),
      ...validation.periodFields,
      timeToPay: parsePaymentDays(invoice.payment_terms),
      showNet: true,
      ...validation.periodFields,
    },
    invoicePosSave: invoice.line_items.map((item, index) => ({
      objectName: "InvoicePos",
      mapAll: true,
      name: item.description,
      text: `${item.qty} x ${Number(item.unit_price ?? item.unit).toFixed(2)} EUR netto`,
      quantity: Number(item.qty),
      price: Number(item.unit_price ?? item.unit),
      taxRate: Number(validation.taxRule.positionTaxRate),
      unity: { id: "1", objectName: "Unity" },
      positionNumber: index + 1,
    })),
    invoicePosDelete: null,
    discountSave: [],
    discountDelete: [],
    takeDefaultAddress: false,
  };
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeCountry(value) {
  return String(value || "").trim().toLocaleLowerCase("de-AT");
}

function parsePaymentDays(value) {
  const match = /(?:innerhalb(?:\s+von)?|binnen)\s+(\d+)\s+Tagen/i.exec(String(value || ""));
  return match ? Number(match[1]) : null;
}

export async function executeCoachInvoiceCreate({
  invoiceId,
  adminId,
  repository,
  provider,
  config,
}) {
  if (!config?.enabled) {
    return {
      status: 503,
      error: "sevdesk_live_workflow_blocked",
      reason: config?.reason || "configuration_missing",
    };
  }

  const invoice = await repository.getDraft(invoiceId);
  if (!invoice) return { status: 404, error: "coach_invoice_not_found" };
  let linkState;
  try {
    linkState = await repository.getLinkState(invoiceId);
  } catch {
    return { status: 503, error: "invoice_link_check_unavailable" };
  }
  if (isCoachInvoiceLinkBlocked(linkState)) {
    return { status: 409, error: "sevdesk_invoice_link_conflict" };
  }
  if (!["unique", "unlinked"].includes(linkState)) {
    return { status: 503, error: "invoice_link_check_unavailable" };
  }

  if (invoice.sevdesk_invoice_id && invoice.sevdesk_send_status === "created") {
    return {
      status: 200,
      ok: true,
      existing: true,
      invoiceId: invoice.sevdesk_invoice_id,
      draftInvoiceNumber: invoice.sevdesk_draft_invoice_number || null,
    };
  }
  if (invoice.sevdesk_send_status === "creating") {
    return { status: 409, error: "manual_reconciliation_required" };
  }
  if (
    ["creation_unknown", "sending", "send_failed", "send_unknown", "sent", "finalized"].includes(
      invoice.sevdesk_send_status
    )
  ) {
    return { status: 409, error: "manual_reconciliation_required" };
  }
  if (invoice.sevdesk_invoice_id) return { status: 409, error: "manually_linked_invoice_blocked" };
  if (invoice.billing_mode !== "quartal") return { status: 409, error: "quarter_invoice_required" };
  if (String(invoice.coach_id) !== String(config.testCoachId)) {
    return { status: 403, error: "test_coach_not_allowed" };
  }

  let accountVersion;
  try {
    accountVersion = await provider.getBookkeepingSystemVersion();
  } catch {
    return { status: 503, error: "sevdesk_account_version_unavailable" };
  }
  if (String(accountVersion) !== config.taxConfig.systemVersion) {
    return { status: 503, error: "sevdesk_account_version_mismatch" };
  }

  const { coach, taxProfile } = await repository.getCoach(invoice.coach_id);
  if (!coach) return { status: 404, error: "coach_not_found" };
  const countryMapping = config.taxConfig.countryMappings[taxProfile?.business_country_code];
  const validation = validateCoachInvoiceDraft(
    invoice,
    {
      ...coach,
      business_country_code: taxProfile?.business_country_code,
      sevdesk_country_id: countryMapping?.id,
    },
    config,
    taxProfile
  );
  if (validation.error) return { status: 409, error: validation.error };

  const release = await repository.getQuarterRelease(invoice);
  if (
    !release ||
    release.release_status !== "released" ||
    Number(release.release_version) !== Number(invoice.coach_quarter_release_version)
  ) {
    return { status: 409, error: "coach_quarter_release_stale" };
  }

  const currentBundle = await repository.getCurrentBundle(invoice, taxProfile);
  if (currentBundle?.calculation_errors?.length > 0) {
    return {
      status: 409,
      error: "billing_calculation_invalid",
      calculation_errors: currentBundle.calculation_errors,
    };
  }
  if (!currentBundle || !savedDraftMatchesBundle(invoice, currentBundle)) {
    return { status: 409, error: "saved_draft_does_not_match_released_sessions" };
  }

  const recipientCheck = await verifySevdeskRecipient({
    invoice,
    coach,
    taxProfile,
    config,
    provider,
  });
  if (recipientCheck) return { status: 409, error: recipientCheck };

  const reservation = await repository.reserveCreation({
    invoiceId,
    adminId,
    releaseVersion: Number(release.release_version),
    expectedUpdatedAt: invoice.updated_at,
  });
  if (reservation?.error) {
    return { status: 503, error: "invoice_workflow_schema_unavailable" };
  }
  if (reservation?.status !== "reserved") {
    return {
      status: 409,
      error: reservation?.status === "stale"
        ? "coach_quarter_release_stale"
        : reservation?.status === "draft_mismatch"
          ? "invoice_draft_changed"
          : reservation?.status === "duplicate"
            ? "invoice_period_duplicate"
            : reservation?.status === "link_conflict"
              ? "sevdesk_invoice_link_conflict"
              : reservation?.status === "blocked"
                ? "manual_reconciliation_required"
              : "invoice_operation_already_reserved",
    };
  }
  let matchingInvoices;
  try {
    if (typeof provider.findInvoicesForQuarter !== "function") {
      throw Object.assign(new Error("sevdesk_duplicate_check_unavailable"), {
        code: "sevdesk_duplicate_check_unavailable",
      });
    }
    matchingInvoices = await provider.findInvoicesForQuarter({
      contactId: coach.sevdesk_contact_id,
      invoice,
    });
    if (!Array.isArray(matchingInvoices)) {
      throw Object.assign(new Error("sevdesk_invoice_list_invalid"), {
        code: "sevdesk_invoice_list_invalid",
      });
    }

    if (matchingInvoices.length > 0) {
      const otherBundleKey = invoice.bundle_key === "reverse_charge"
        ? "normal_ust"
        : "reverse_charge";
      const otherBundle = await repository.getCurrentBundle({
        ...invoice,
        bundle_key: otherBundleKey,
      });
      let isConfirmedOtherBundle = matchingInvoices.length === 1 && Boolean(otherBundle);
      for (const candidate of matchingInvoices) {
        if (
          candidate?.__poisePeriodMatch !== "same_period" ||
          !candidate?.id ||
          typeof provider.getInvoicePositions !== "function"
        ) {
          isConfirmedOtherBundle = false;
          break;
        }
        const positions = await provider.getInvoicePositions(candidate.id);
        if (
          positionsMatchBundle(positions, currentBundle, config) ||
          !positionsMatchBundle(positions, otherBundle, config)
        ) {
          isConfirmedOtherBundle = false;
          break;
        }
      }
      if (!isConfirmedOtherBundle) {
        const blocked = await repository.markCreationUnknown(
          invoiceId,
          "sevdesk_period_invoice_exists"
        );
        return {
          status: blocked ? 409 : 500,
          error: blocked
            ? "sevdesk_period_invoice_exists"
            : "duplicate_found_but_local_state_update_failed",
        };
      }
    }
  } catch {
    const blocked = await repository.markCreationUnknown(
      invoiceId,
      "sevdesk_duplicate_check_unavailable"
    );
    return {
      status: blocked ? 502 : 500,
      error: blocked
        ? "sevdesk_duplicate_check_unavailable"
        : "duplicate_check_failed_local_state_update_failed",
    };
  }

  let created;
  try {
    created = await provider.createInvoice(
      buildSevdeskCoachInvoicePayload(
        invoice,
        {
          ...coach,
          business_country_code: taxProfile?.business_country_code,
          sevdesk_country_id: countryMapping.id,
          ...taxProfile,
        },
        config
      )
    );
  } catch (error) {
    const blocked = await repository.markCreationUnknown(invoiceId);
    return {
      status: blocked ? 502 : 500,
      error: blocked
        ? "invoice_creation_result_unknown"
        : "invoice_creation_state_persistence_failed",
      providerStatus: Number(error?.status) || null,
    };
  }
  const createdInvoiceId = extractInvoiceId(created);
  if (!createdInvoiceId) {
    const blocked = await repository.markCreationUnknown(invoiceId);
    return {
      status: blocked ? 502 : 500,
      error: blocked
        ? "invoice_creation_result_unknown"
        : "invoice_creation_state_persistence_failed",
    };
  }

  const draftInvoiceNumber = extractInvoice(created)?.invoiceNumber || null;
  let saved = false;
  try {
    saved = await repository.saveCreated({
      invoiceId,
      sevdeskInvoiceId: createdInvoiceId,
      draftInvoiceNumber,
    });
  } catch {
    saved = false;
  }
  if (!saved) {
    await repository.markCreationUnknown(
      invoiceId, "invoice_created_but_persistence_failed", createdInvoiceId
    );
    return { status: 500, error: "invoice_created_but_persistence_failed" };
  }

  return {
    status: 201,
    ok: true,
    invoiceId: createdInvoiceId,
    draftInvoiceNumber,
    sendStatus: "created",
  };
}

function positionsMatchBundle(positions, bundle, config) {
  if (!Array.isArray(positions) || positions.length === 0 || !bundle?.rows?.length) {
    return false;
  }
  const rule = config.taxConfig.treatments[bundle.tax_treatment];
  if (!rule) return false;

  const signature = (items, isExternal) => items.map((item) => {
    const name = String(isExternal ? item?.name : item?.description || "").trim();
    const quantity = Number(isExternal ? item?.quantity : item?.qty);
    const price = normalizeMoney(isExternal ? item?.price : item?.unit_price_net);
    const taxRate = normalizeMoney(isExternal ? item?.taxRate : rule.positionTaxRate);
    return [name, quantity, price, taxRate];
  }).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

  return JSON.stringify(signature(positions, true)) ===
    JSON.stringify(signature(bundle.rows, false));
}

export async function readCoachInvoiceStatus({ invoiceId, repository, provider }) {
  const invoice = await repository.getDraft(invoiceId);
  if (!invoice) return { status: 404, error: "coach_invoice_not_found" };
  if (!invoice.sevdesk_invoice_id) {
    return { status: 409, error: "sevdesk_invoice_not_created" };
  }

  let currentInvoice;
  try {
    currentInvoice = await provider.getInvoice(invoice.sevdesk_invoice_id);
  } catch {
    return { status: 502, error: "invoice_status_unavailable" };
  }
  if (!currentInvoice) return { status: 404, error: "sevdesk_invoice_not_found" };

  return {
    status: 200,
    ok: true,
    invoiceId: invoice.sevdesk_invoice_id,
    invoiceStatus: String(currentInvoice.status ?? ""),
    invoiceNumber: currentInvoice.invoiceNumber || null,
    sendDate: currentInvoice.sendDate || null,
    isDraft: String(currentInvoice.status) === "100",
  };
}

function savedDraftMatchesBundle(invoice, bundle) {
  const draftLines = [...(invoice.line_items || [])]
    .map((item) => [
      Number(item.qty),
      normalizeMoney(item.unit_price ?? item.unit),
      normalizeMoney(item.total),
    ])
    .sort(compareLineSignature);
  const expectedLines = [...(bundle.rows || [])]
    .map((item) => [
      Number(item.qty),
      normalizeMoney(item.unit_price_net),
      normalizeMoney(item.total_net),
    ])
    .sort(compareLineSignature);
  return (
    JSON.stringify(draftLines) === JSON.stringify(expectedLines) &&
    normalizeMoney(invoice.total_net) === normalizeMoney(bundle.subtotal_net) &&
    normalizeMoney(invoice.vat_amount) === normalizeMoney(bundle.vat_amount) &&
    normalizeMoney(invoice.total_gross) === normalizeMoney(bundle.total_gross)
  );
}

function compareLineSignature(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

async function verifySevdeskRecipient({ invoice, coach, taxProfile, config, provider }) {
  const expectedName = normalizeIdentity(
    taxProfile?.company_name || coach.profile_name || coach.name
  );
  const draftName = normalizeIdentity(invoice.client_name);
  if (!expectedName || expectedName !== draftName) return "recipient_name_mismatch";

  let contact;
  let communicationWays;
  try {
    [contact, communicationWays] = await Promise.all([
      provider.getContact(coach.sevdesk_contact_id),
      provider.getContactEmails(coach.sevdesk_contact_id),
    ]);
  } catch {
    return "sevdesk_contact_unavailable";
  }

  const contactName = normalizeIdentity(contact?.name || contact?.name2);
  if (!contactName || contactName !== expectedName) return "sevdesk_contact_name_mismatch";
  if (taxProfile?.vat_number && normalizeIdentity(contact?.vatNumber) !== normalizeIdentity(taxProfile.vat_number)) {
    return "sevdesk_contact_vat_number_mismatch";
  }
  const addresses = (communicationWays || [])
    .filter((way) => way?.type === "EMAIL")
    .map((way) => normalizeEmail(way.value));
  if (!addresses.includes(normalizeEmail(coach.email)) ||
      !addresses.includes(normalizeEmail(invoice.client_email))) {
    return "sevdesk_contact_email_mismatch";
  }

  const country = config.taxConfig.countryMappings[taxProfile?.business_country_code];
  if (!country || !country.aliases.some((alias) => normalizeCountry(alias) === normalizeCountry(invoice.client_country))) {
    return "recipient_country_mismatch";
  }
  const configuredAddress = String(taxProfile?.address || "").split("\n").map(normalizeIdentity).filter(Boolean);
  if (!configuredAddress.length ||
      normalizeIdentity(invoice.client_street) !== configuredAddress[0] ||
      normalizeIdentity(invoice.client_city) !== configuredAddress.slice(1).join(" ")) {
    return "recipient_address_mismatch";
  }
  return null;
}

function extractInvoiceId(response) {
  const invoice = extractInvoice(response);
  const id = invoice?.id || response?.object?.id;
  return id == null ? null : String(id);
}

function extractInvoice(response) {
  const rawInvoice = response?.invoice || response?.objects?.invoice || response?.objects;
  return Array.isArray(rawInvoice) ? rawInvoice[0] : rawInvoice;
}

function normalizeIdentity(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("de-AT");
}