import {
  buildCoachBillingPeriod,
  calculateCoachBundles,
  formatCoachBillingPeriod,
  getViennaCalendarDate,
  lineItemsFromCoachBundle,
  toStoredBundleKey,
} from "../../../lib/coachBilling.js";

const SESSION_SELECT = `
  id,
  date,
  price,
  therapist_id,
  anfrage_id,
  anfragen (
    id,
    beschaeftigungsgrad,
    invoice_with_vat
  )
`;

export function normalizeBillingPeriod(input = {}) {
  const billingMode = String(input.billingMode || input.billing_mode || "quartal");
  const billingDate = String(input.billingDate ?? input.billing_date ?? "");
  const now = new Date();
  const current = getViennaCalendarDate(now);
  const dateYear = billingMode === "einzeln"
    ? Number(billingDate.slice(0, 4))
    : current.year;
  const rawYear = input.billingYear ?? input.billing_year;
  const billingYear = Number(rawYear || dateYear || current.year);
  const billingQuarter = billingMode === "quartal"
    ? Number(
        input.billingQuarter ||
          input.billing_quarter ||
          Math.floor((current.month - 1) / 3) + 1
      )
    : null;
  const billingMonth = billingMode === "monat"
    ? Number(input.billingMonth || input.billing_month || current.month)
    : null;
  const periodInput = {
    billingMode,
    billingYear,
    billingQuarter,
    billingMonth,
    billingDate,
  };

  return {
    ...periodInput,
    range: buildCoachBillingPeriod({ ...periodInput, now }),
    label: formatCoachBillingPeriod(periodInput),
    invoiceSupported: billingMode !== "einzeln",
  };
}

export async function loadCoachBillingContext(supabase, { coachId, periodInput }) {
  const period = normalizeBillingPeriod(periodInput);
  const [coachResult, settingsResult, sessionsResult] = await Promise.all([
    supabase
      .from("team_members")
      .select("id, email, profile_name")
      .eq("id", coachId)
      .single(),
    supabase
      .from("therapist_invoice_settings")
      .select("*")
      .eq("therapist_id", coachId)
      .maybeSingle(),
    supabase
      .from("sessions")
      .select(SESSION_SELECT)
      .eq("therapist_id", coachId)
      .gte("date", period.range.start)
      .lt("date", period.range.end)
      .order("date", { ascending: true })
      .range(0, 9999),
  ]);

  const error =
    coachResult.error || settingsResult.error || sessionsResult.error || null;
  if (error) return { error };

  const coachTaxProfile = settingsResult.data || {};
  return {
    coach: coachResult.data,
    coachTaxProfile,
    period,
    sessions: sessionsResult.data || [],
    bundles: calculateCoachBundles({
      sessions: sessionsResult.data || [],
      coachTaxProfile,
    }),
  };
}

function applyPeriodFilters(query, period) {
  query = query.eq("billing_year", period.billingYear);
  if (period.billingMode === "quartal") {
    query = query.eq("billing_quarter", period.billingQuarter);
  }
  if (period.billingMode === "monat") {
    query = query.eq("billing_month", period.billingMonth);
  }
  return query;
}

export async function loadCoachInvoice(supabase, { coachId, period, bundleType }) {
  const bundleKey = toStoredBundleKey(bundleType);
  if (!bundleKey) return { data: null, error: null };
  if (!period.invoiceSupported) {
    return { data: null, error: { code: "UNSUPPORTED_INVOICE_PERIOD" } };
  }

  let query = supabase
    .from("coach_invoices")
    .select("*")
    .eq("coach_id", coachId)
    .eq("billing_mode", period.billingMode)
    .eq("bundle_key", bundleKey);

  query = applyPeriodFilters(query, period)
    .order("created_at", { ascending: false })
    .limit(2);

  const { data, error } = await query;
  if (error) return { data: null, error };
  if (data?.length > 1) {
    return { data: null, error: { code: "AMBIGUOUS_INVOICE_PERIOD" } };
  }
  return { data: data?.[0] || null, error: null };
}

export async function loadCoachInvoicesForPeriod(supabase, { coachId, period }) {
  if (!period.invoiceSupported) return { data: [], error: null };

  let query = supabase
    .from("coach_invoices")
    .select("id, coach_id, billing_mode, billing_year, billing_quarter, billing_month, bundle_key")
    .eq("coach_id", coachId)
    .eq("billing_mode", period.billingMode)
    .in("bundle_key", ["reverse_charge", "normal_ust"]);

  query = applyPeriodFilters(query, period);

  return query;
}

export function invoiceLineItemsFromBundle(bundle) {
  return lineItemsFromCoachBundle(bundle);
}