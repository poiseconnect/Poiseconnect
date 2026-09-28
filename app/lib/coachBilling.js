export const COACH_BILLING_TIME_ZONE = "Europe/Vienna";

const BUNDLE_KEY_BY_TYPE = {
  client_with_vat: "reverse_charge",
  client_without_vat: "normal_ust",
};

const BUNDLE_TYPE_BY_KEY = Object.fromEntries(
  Object.entries(BUNDLE_KEY_BY_TYPE).map(([type, key]) => [key, type])
);

const EU_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
  "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
  "NL", "PL", "PT", "RO", "SE", "SI", "SK",
]);

const viennaDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: COACH_BILLING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function getViennaDateParts(date) {
  const parts = viennaDateTimeFormatter.formatToParts(date);
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
}

export function getViennaCalendarDate(now = new Date()) {
  const { year, month, day } = getViennaDateParts(now);
  return { year, month, day };
}

function viennaMidnightToUtc(year, month, day) {
  const targetAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  let candidate = targetAsUtc;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const local = getViennaDateParts(new Date(candidate));
    const representedAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second
    );
    const correction = targetAsUtc - representedAsUtc;
    candidate += correction;
    if (correction === 0) break;
  }

  return new Date(candidate).toISOString();
}

function validateDateParts(year, month, day) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1000 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate()
  ) {
    throw new TypeError("Ungültiger Abrechnungszeitraum");
  }
}

export function buildCoachBillingPeriod({
  billingMode = "quartal",
  billingYear,
  billingQuarter,
  billingMonth,
  billingDate,
  now = new Date(),
}) {
  const current = getViennaDateParts(now);
  const year = Number(billingYear || current.year);

  if (billingMode === "einzeln") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(billingDate || ""));
    if (!match) throw new TypeError("Ungültiges Abrechnungsdatum");
    const [, dateYear, dateMonth, dateDay] = match.map(Number);
    validateDateParts(dateYear, dateMonth, dateDay);
    return {
      start: viennaMidnightToUtc(dateYear, dateMonth, dateDay),
      end: viennaMidnightToUtc(dateYear, dateMonth, dateDay + 1),
    };
  }

  let startMonth = 1;
  let endMonth = 13;

  if (billingMode === "quartal") {
    const quarter = Number(
      billingQuarter || Math.floor((current.month - 1) / 3) + 1
    );
    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
      throw new TypeError("Ungültiges Abrechnungsquartal");
    }
    startMonth = (quarter - 1) * 3 + 1;
    endMonth = startMonth + 3;
  } else if (billingMode === "monat") {
    const month = Number(billingMonth || current.month);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new TypeError("Ungültiger Abrechnungsmonat");
    }
    startMonth = month;
    endMonth = month + 1;
  } else if (billingMode !== "jahr") {
    throw new TypeError("Nicht unterstützter Abrechnungszeitraum");
  }

  validateDateParts(year, startMonth, 1);
  const endYear = endMonth === 13 ? year + 1 : year;
  const normalizedEndMonth = endMonth === 13 ? 1 : endMonth;

  return {
    start: viennaMidnightToUtc(year, startMonth, 1),
    end: viennaMidnightToUtc(endYear, normalizedEndMonth, 1),
  };
}

export function formatCoachBillingPeriod({
  billingMode = "quartal",
  billingYear,
  billingQuarter,
  billingMonth,
  billingDate,
}) {
  if (billingMode === "quartal") return `Q${billingQuarter} ${billingYear}`;
  if (billingMode === "monat") return `${billingMonth}/${billingYear}`;
  if (billingMode === "jahr") return `${billingYear}`;
  if (billingMode === "einzeln") return String(billingDate || "");
  return "";
}

export function toStoredBundleKey(bundleType) {
  return BUNDLE_KEY_BY_TYPE[bundleType] || null;
}

export function toSemanticBundleType(bundleKey) {
  return BUNDLE_TYPE_BY_KEY[bundleKey] || null;
}

export function lineItemsFromCoachBundle(bundle) {
  return (bundle?.rows || []).map((row, index) => ({
    id: row.id || `${index + 1}`,
    pos: index + 1,
    description: `${row.label} – Provision`,
    qty: Number(row.qty || 0),
    unit_price: Number(row.unit_price_net || 0),
    total: Number(row.total_net || 0),
  }));
}

function normalizeDraftLineItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    description: String(item?.description || ""),
    qty: Number(item?.qty || 0),
    unit_price: Number(item?.unit_price ?? item?.unit ?? 0),
    total: Number(item?.total || 0),
  }));
}

function currentCalculationFromBundle(bundle) {
  if (!bundle) return null;
  return {
    bundle_type: bundle.bundle_type,
    bundle_key: bundle.bundle_key,
    session_ids: [...bundle.session_ids],
    session_count: bundle.session_count,
    line_items: lineItemsFromCoachBundle(bundle),
    total_net: Number(bundle.subtotal_net || 0),
    vat_amount: Number(bundle.vat_amount || 0),
    total_gross: Number(bundle.total_gross || 0),
    invoice_with_vat: bundle.tax_treatment === "vat",
    tax_treatment: bundle.tax_treatment,
    tax_reason: bundle.tax_reason,
    vat_rate: Number(bundle.vat_rate || 0),
    calculation_errors: bundle.calculation_errors || [],
  };
}

function savedDraftFromInvoice(invoice) {
  if (!invoice) return null;
  return {
    ...invoice,
    line_items: Array.isArray(invoice.line_items) ? invoice.line_items : [],
    total_net: Number(invoice.total_net || 0),
    vat_amount: Number(invoice.vat_amount || 0),
    total_gross: Number(invoice.total_gross || 0),
    vat_rate: Number(invoice.vat_rate || 0),
    invoice_with_vat: invoice.invoice_with_vat === true,
    tax_treatment: invoice.tax_treatment || null,
    tax_reason: invoice.tax_reason || null,
  };
}

function automaticValues(draft) {
  if (!draft) return null;
  return {
    line_items: normalizeDraftLineItems(draft.line_items),
    total_net: Number(draft.total_net || 0),
    vat_amount: Number(draft.vat_amount || 0),
    total_gross: Number(draft.total_gross || 0),
    invoice_with_vat: draft.invoice_with_vat === true,
    tax_treatment: draft.tax_treatment || null,
    tax_reason: draft.tax_reason || null,
    vat_rate: Number(draft.vat_rate || 0),
  };
}

export function getCoachInvoiceDraftView({ invoice, calculatedBundle }) {
  const savedDraft = savedDraftFromInvoice(invoice);
  const currentCalculation = currentCalculationFromBundle(calculatedBundle);
  const hasCalculationDifference = Boolean(
    savedDraft &&
      JSON.stringify(automaticValues(savedDraft)) !==
        JSON.stringify(automaticValues(currentCalculation))
  );

  return {
    saved_draft: savedDraft,
    current_calculation: currentCalculation,
    primary_draft: savedDraft || currentCalculation,
    has_calculation_difference: hasCalculationDifference,
  };
}

export function applyCurrentCalculationToDraft(invoice, calculatedBundle) {
  const calculation = currentCalculationFromBundle(calculatedBundle);
  if (!calculation) return null;

  return {
    ...invoice,
    line_items: calculation.line_items,
    total_net: calculation.total_net,
    vat_amount: calculation.vat_amount,
    total_gross: calculation.total_gross,
    invoice_with_vat: calculation.invoice_with_vat,
    tax_treatment: calculation.tax_treatment,
    tax_reason: calculation.tax_reason,
    vat_rate: calculation.vat_rate,
  };
}

export function uidConfirmationNeedsInvalidation(current, next) {
  const currentUid = String(current?.vat_number || "").trim();
  const nextUid = String(next?.vat_number || "").trim();
  const currentCountry = String(current?.business_country_code || "")
    .trim()
    .toUpperCase();
  const nextCountry = String(next?.business_country_code || "")
    .trim()
    .toUpperCase();

  return currentUid !== nextUid || currentCountry !== nextCountry;
}

export function calculateCoachBundles({ sessions = [], coachTaxProfile = {} }) {
  const coachVatRate = Number(coachTaxProfile.default_vat_rate);
  const validCoachVatRate = Number.isFinite(coachVatRate) && coachVatRate > 0;
  const bundles = {
    client_with_vat: {
      bundle_type: "client_with_vat",
      bundle_key: BUNDLE_KEY_BY_TYPE.client_with_vat,
      title: "Klient:innen mit Umsatzsteuer",
      session_ids: [],
      session_snapshot: [],
      rowsMap: new Map(),
      calculation_errors: [],
    },
    client_without_vat: {
      bundle_type: "client_without_vat",
      bundle_key: BUNDLE_KEY_BY_TYPE.client_without_vat,
      title: "Klient:innen ohne Umsatzsteuer",
      session_ids: [],
      session_snapshot: [],
      rowsMap: new Map(),
      calculation_errors: [],
    },
  };

  for (const session of sessions) {
    const clientWithVat = session?.anfragen?.invoice_with_vat === true;
    const bundle = clientWithVat
      ? bundles.client_with_vat
      : bundles.client_without_vat;
    const price = Number(session?.price);

    if (!session?.id || !Number.isFinite(price) || price <= 0) continue;

    bundle.session_ids.push(session.id);

    if (clientWithVat && !validCoachVatRate) {
      bundle.session_snapshot.push({
        session_id: session.id,
        session_date: session.date || null,
        client_price: price,
        client_with_vat: true,
        coach_vat_rate: null,
        net_basis: null,
        commission_net: null,
      });
      bundle.calculation_errors.push({
        session_id: session.id,
        code: "coach_vat_rate_missing",
      });
      continue;
    }

    const clientNet = clientWithVat
      ? price / (1 + coachVatRate / 100)
      : price;
    const provisionNet = roundMoney(clientNet * 0.3);
    bundle.session_snapshot.push({
      session_id: session.id,
      session_date: session.date || null,
      client_price: price,
      client_with_vat: clientWithVat,
      coach_vat_rate: clientWithVat ? coachVatRate : null,
      net_basis: roundMoney(clientNet),
      commission_net: provisionNet,
    });
    const groupLabel =
      session?.anfragen?.beschaeftigungsgrad === "ausbildung"
        ? "Ausbildung"
        : "Berufstätig";
    const unitKey = `${groupLabel}__${provisionNet.toFixed(2)}`;
    const row = bundle.rowsMap.get(unitKey) || {
      id: unitKey,
      label: groupLabel,
      qty: 0,
      unit_price_net: provisionNet,
      total_net: 0,
    };

    row.qty += 1;
    row.total_net = roundMoney(row.total_net + provisionNet);
    bundle.rowsMap.set(unitKey, row);
  }

  return Object.values(bundles)
    .map((bundle) => {
      const rows = [...bundle.rowsMap.values()].sort((a, b) =>
        a.label.localeCompare(b.label)
      );
      const subtotalNet = roundMoney(
        rows.reduce((sum, row) => sum + row.total_net, 0)
      );
      const tax = resolveCoachInvoiceTax(coachTaxProfile);
      const vatAmount = roundMoney(subtotalNet * (tax.vat_rate / 100));

      return {
        bundle_type: bundle.bundle_type,
        bundle_key: bundle.bundle_key,
        title: bundle.title,
        session_ids: bundle.session_ids,
        session_snapshot: bundle.session_snapshot,
        session_count: bundle.session_ids.length,
        rows,
        calculation_errors: bundle.calculation_errors,
        subtotal_net: subtotalNet,
        tax_treatment: tax.tax_treatment,
        tax_reason: tax.tax_reason,
        vat_rate: tax.vat_rate,
        vat_amount: vatAmount,
        total_gross: roundMoney(subtotalNet + vatAmount),
      };
    })
    .filter((bundle) => bundle.session_count > 0);
}

export function resolveCoachInvoiceTax(coachTaxProfile = {}) {
  const country = String(coachTaxProfile.business_country_code || "")
    .trim()
    .toUpperCase();

  if (country === "AT") {
    return {
      tax_treatment: "vat",
      vat_rate: 20,
      tax_reason: "austrian_business_seat",
    };
  }

  if (EU_COUNTRY_CODES.has(country)) {
    const hasUid = Boolean(String(coachTaxProfile.vat_number || "").trim());
    const uidConfirmed = Boolean(
      coachTaxProfile.uid_confirmed_at && coachTaxProfile.uid_confirmed_by
    );

    if (hasUid && uidConfirmed) {
      return {
        tax_treatment: "reverse_charge",
        vat_rate: 0,
        tax_reason: "eu_uid_manually_confirmed",
      };
    }

    return {
      tax_treatment: "review_required",
      vat_rate: 0,
      tax_reason: hasUid ? "eu_uid_not_confirmed" : "eu_uid_missing",
    };
  }

  return {
    tax_treatment: "review_required",
    vat_rate: 0,
    tax_reason: country ? "unsupported_business_country" : "business_country_missing",
  };
}
