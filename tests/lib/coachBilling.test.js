import { describe, expect, it } from "vitest";
import {
  applyCurrentCalculationToDraft,
  buildCoachBillingPeriod,
  calculateCoachBundles,
  getCoachInvoiceDraftView,
  resolveCoachInvoiceTax,
  toSemanticBundleType,
  toStoredBundleKey,
  uidConfirmationNeedsInvalidation,
} from "../../app/lib/coachBilling.js";
import { normalizeBillingPeriod } from "../../app/api/invoices/_lib/coachInvoice.js";
import { loadCoachInvoice } from "../../app/api/invoices/_lib/coachInvoice.js";

function session(id, price, invoiceWithVat, therapistId = "coach-1") {
  return {
    id,
    date: "2026-07-15T10:00:00.000Z",
    therapist_id: therapistId,
    price,
    anfrage_id: `request-${id}`,
    anfragen: {
      invoice_with_vat: invoiceWithVat,
      beschaeftigungsgrad: "berufstaetig",
    },
  };
}

function mockInvoiceDatabase(rows) {
  const filters = [];
  const query = {
    select() {
      return query;
    },
    eq(column, value) {
      filters.push(["eq", column, value]);
      return query;
    },
    is(column, value) {
      filters.push(["is", column, value]);
      return query;
    },
    order() {
      return query;
    },
    limit() {
      return Promise.resolve({ data: rows, error: null });
    },
  };

  return {
    filters,
    supabase: {
      from(table) {
        expect(table).toBe("coach_invoices");
        return query;
      },
    },
  };
}

describe("coach billing calculations", () => {
  it("maps semantic bundle types to unchanged legacy database keys", () => {
    expect(toStoredBundleKey("client_with_vat")).toBe("reverse_charge");
    expect(toStoredBundleKey("client_without_vat")).toBe("normal_ust");
    expect(toSemanticBundleType("reverse_charge")).toBe("client_with_vat");
    expect(toSemanticBundleType("normal_ust")).toBe("client_without_vat");
  });

  it("splits AT client bundles, keeps commission bases, and applies 20 percent Poise VAT to both", () => {
    const bundles = calculateCoachBundles({
      sessions: [session("at-in", 120, true), session("at-out", 100, false)],
      coachTaxProfile: {
        business_country_code: "AT",
        default_vat_rate: 20,
      },
    });

    expect(bundles.map((bundle) => bundle.bundle_type)).toEqual([
      "client_with_vat",
      "client_without_vat",
    ]);
    expect(bundles[0].rows[0].unit_price_net).toBe(30);
    expect(bundles[1].rows[0].unit_price_net).toBe(30);
    expect(bundles.every((bundle) => bundle.tax_treatment === "vat")).toBe(true);
    expect(bundles.every((bundle) => bundle.vat_rate === 20)).toBe(true);
    expect(bundles[0].total_gross).toBe(36);
    expect(bundles[1].total_gross).toBe(36);
  });

  it("uses 19 percent for German client prices including VAT", () => {
    const [bundle] = calculateCoachBundles({
      sessions: [session("de-in", 119, true)],
      coachTaxProfile: {
        business_country_code: "DE",
        vat_number: "DE123456789",
        uid_confirmed_at: "2026-01-01T00:00:00.000Z",
        uid_confirmed_by: "admin-1",
        default_vat_rate: 19,
      },
    });

    expect(bundle.rows[0].unit_price_net).toBe(30);
    expect(bundle.tax_treatment).toBe("reverse_charge");
    expect(bundle.vat_rate).toBe(0);
  });

  it("keeps 36 German 200 euro gross sessions at 50.42 commission and Reverse Charge", () => {
    const sessions = Array.from({ length: 36 }, (_, index) =>
      session(`sophie-with-${index + 1}`, 200, true)
    );
    const [bundle] = calculateCoachBundles({
      sessions,
      coachTaxProfile: {
        business_country_code: "DE",
        vat_number: "DE123456789",
        uid_confirmed_at: "2026-01-01T00:00:00.000Z",
        uid_confirmed_by: "admin-1",
        default_vat_rate: 19,
      },
    });

    expect(bundle.rows[0].qty).toBe(36);
    expect(bundle.rows[0].unit_price_net).toBe(50.42);
    expect(bundle.subtotal_net).toBe(1815.12);
    expect(bundle.tax_treatment).toBe("reverse_charge");
    expect(bundle.vat_rate).toBe(0);
    expect(bundle.vat_amount).toBe(0);
  });

  it("uses the full German client price and 20 percent Poise VAT without client VAT", () => {
    const [bundle] = calculateCoachBundles({
      sessions: [session("de-out", 200, false)],
      coachTaxProfile: {
        business_country_code: "DE",
        vat_number: "DE123456789",
        uid_confirmed_at: "2026-01-01T00:00:00.000Z",
        uid_confirmed_by: "admin-1",
        default_vat_rate: 19,
      },
    });

    expect(bundle.bundle_type).toBe("client_without_vat");
    expect(bundle.rows[0].unit_price_net).toBe(60);
    expect(bundle.subtotal_net).toBe(60);
    expect(bundle.tax_treatment).toBe("vat");
    expect(bundle.vat_rate).toBe(20);
    expect(bundle.vat_amount).toBe(12);
    expect(bundle.total_gross).toBe(72);
  });

  it("reconstructs Sophie's German without-client-VAT bundle totals without changing commission basis", () => {
    const sessions = [
      ...Array.from({ length: 42 }, (_, index) => session(`sophie-45-${index}`, 150, false)),
      ...Array.from({ length: 50 }, (_, index) => session(`sophie-60-${index}`, 200, false)),
      session("sophie-42", 140, false),
    ];
    const [bundle] = calculateCoachBundles({
      sessions,
      coachTaxProfile: {
        business_country_code: "DE",
        vat_number: "DE123456789",
        uid_confirmed_at: "2026-01-01T00:00:00.000Z",
        uid_confirmed_by: "admin-1",
        default_vat_rate: 19,
      },
    });

    expect(bundle.session_count).toBe(93);
    expect(bundle.rows.map(({ qty, unit_price_net }) => [qty, unit_price_net])).toEqual([
      [42, 45],
      [50, 60],
      [1, 42],
    ]);
    expect(bundle.subtotal_net).toBe(4932);
    expect(bundle.tax_treatment).toBe("vat");
    expect(bundle.vat_rate).toBe(20);
    expect(bundle.vat_amount).toBe(986.4);
    expect(bundle.total_gross).toBe(5918.4);
  });

  it("applies different Poise tax treatments to both bundles for one German coach", () => {
    const bundles = calculateCoachBundles({
      sessions: [session("de-with", 119, true), session("de-without", 200, false)],
      coachTaxProfile: {
        business_country_code: "DE",
        vat_number: "DE123456789",
        uid_confirmed_at: "2026-01-01T00:00:00.000Z",
        uid_confirmed_by: "admin-1",
        default_vat_rate: 19,
      },
    });

    const withVat = bundles.find((bundle) => bundle.bundle_type === "client_with_vat");
    const withoutVat = bundles.find((bundle) => bundle.bundle_type === "client_without_vat");

    expect(withVat.rows[0].unit_price_net).toBe(30);
    expect(withVat.tax_treatment).toBe("reverse_charge");
    expect(withVat.vat_rate).toBe(0);
    expect(withoutVat.rows[0].unit_price_net).toBe(60);
    expect(withoutVat.tax_treatment).toBe("vat");
    expect(withoutVat.vat_rate).toBe(20);
    expect(withoutVat.total_gross).toBe(72);
  });

  it("blocks client-with-VAT commission calculation if coach rate is missing", () => {
    const [bundle] = calculateCoachBundles({
      sessions: [session("missing-rate", 120, true)],
      coachTaxProfile: { business_country_code: "AT" },
    });

    expect(bundle.session_count).toBe(1);
    expect(bundle.calculation_errors).toEqual([
      { session_id: "missing-rate", code: "coach_vat_rate_missing" },
    ]);
    expect(bundle.rows).toEqual([]);
  });

  it("returns review_required for an EU UID that was entered but not confirmed", () => {
    expect(
      resolveCoachInvoiceTax({
        coachTaxProfile: {
          business_country_code: "DE",
          vat_number: "DE123456789",
        },
        bundleType: "client_with_vat",
      })
    ).toMatchObject({
      tax_treatment: "review_required",
      tax_reason: "de_uid_not_confirmed",
    });
  });

  it("requires review for a DE client-with-VAT bundle with no UID", () => {
    expect(
      resolveCoachInvoiceTax({
        coachTaxProfile: { business_country_code: "DE" },
        bundleType: "client_with_vat",
      })
    ).toMatchObject({
      tax_treatment: "review_required",
      tax_reason: "de_uid_missing",
    });
  });

  it("applies Austrian VAT to both bundles and does not use Reverse Charge", () => {
    const profile = { business_country_code: "AT", default_vat_rate: 20 };

    expect(
      resolveCoachInvoiceTax({
        coachTaxProfile: profile,
        bundleType: "client_with_vat",
      })
    ).toMatchObject({ tax_treatment: "vat", vat_rate: 20 });
    expect(
      resolveCoachInvoiceTax({
        coachTaxProfile: profile,
        bundleType: "client_without_vat",
      })
    ).toMatchObject({ tax_treatment: "vat", vat_rate: 20 });
  });

  it("does not generalize Reverse Charge to other EU countries", () => {
    expect(
      resolveCoachInvoiceTax({
        coachTaxProfile: {
          business_country_code: "FR",
          vat_number: "FR12345678901",
          uid_confirmed_at: "2026-01-01T00:00:00.000Z",
          uid_confirmed_by: "admin-1",
        },
        bundleType: "client_with_vat",
      })
    ).toMatchObject({
      tax_treatment: "review_required",
      tax_reason: "unsupported_client_with_vat_country",
    });
  });

  it("requires review for a missing or unsupported bundle type", () => {
    expect(resolveCoachInvoiceTax({ coachTaxProfile: { business_country_code: "DE" } }))
      .toMatchObject({ tax_treatment: "review_required", vat_rate: 0 });
  });

  it("requires review for a missing country in the client-with-VAT bundle", () => {
    expect(
      resolveCoachInvoiceTax({
        coachTaxProfile: {},
        bundleType: "client_with_vat",
      }).tax_reason
    ).toBe("business_country_missing");
  });

  it("requires review if the semantic bundle type is missing or unsupported", () => {
    expect(
      resolveCoachInvoiceTax({
        coachTaxProfile: { business_country_code: "DE" },
      })
    ).toMatchObject({
      tax_treatment: "review_required",
      tax_reason: "client_bundle_type_missing_or_unsupported",
    });
  });

  it("uses Vienna calendar boundaries converted to UTC", () => {
    expect(
      buildCoachBillingPeriod({
        billingMode: "quartal",
        billingYear: 2026,
        billingQuarter: 3,
      })
    ).toEqual({
      start: "2026-06-30T22:00:00.000Z",
      end: "2026-09-30T22:00:00.000Z",
    });
  });

  it("rejects impossible local billing dates", () => {
    expect(() =>
      buildCoachBillingPeriod({
        billingMode: "einzeln",
        billingDate: "2026-02-31",
      })
    ).toThrow("Ungültiger Abrechnungszeitraum");
  });

  it("canonicalizes irrelevant month and quarter fields for existing invoice keys", () => {
    const quarterWithJanuary = normalizeBillingPeriod({
      billingMode: "quartal",
      billingYear: 2026,
      billingQuarter: 3,
      billingMonth: 1,
    });
    const quarterWithSeptember = normalizeBillingPeriod({
      billingMode: "quartal",
      billingYear: 2026,
      billingQuarter: 3,
      billingMonth: 9,
    });
    const month = normalizeBillingPeriod({
      billingMode: "monat",
      billingYear: 2026,
      billingQuarter: 3,
      billingMonth: 9,
    });

    expect(quarterWithJanuary.billingMonth).toBeNull();
    expect(quarterWithSeptember.billingMonth).toBeNull();
    expect(quarterWithJanuary.billingQuarter).toBe(3);
    expect(quarterWithJanuary.range).toEqual(quarterWithSeptember.range);
    expect(month.billingQuarter).toBeNull();
    expect(month.billingMonth).toBe(9);
  });

  it("looks up quarter invoices without the irrelevant legacy month field", async () => {
    const database = mockInvoiceDatabase([{ id: "draft-1" }]);
    const period = normalizeBillingPeriod({
      billingMode: "quartal",
      billingYear: 2026,
      billingQuarter: 3,
      billingMonth: 9,
    });
    const result = await loadCoachInvoice(database.supabase, {
      coachId: "coach-1",
      period,
      bundleType: "client_with_vat",
    });

    expect(result.data.id).toBe("draft-1");
    expect(database.filters).toContainEqual(["eq", "billing_quarter", 3]);
    expect(database.filters.some(([, column]) => column === "billing_month")).toBe(false);
  });

  it("blocks multiple historical rows for one semantic invoice period", async () => {
    const database = mockInvoiceDatabase([{ id: "legacy-1" }, { id: "legacy-2" }]);
    const period = normalizeBillingPeriod({
      billingMode: "quartal",
      billingYear: 2026,
      billingQuarter: 3,
    });
    const result = await loadCoachInvoice(database.supabase, {
      coachId: "coach-1",
      period,
      bundleType: "client_with_vat",
    });

    expect(result.data).toBeNull();
    expect(result.error.code).toBe("AMBIGUOUS_INVOICE_PERIOD");
  });

  it("marks single-day periods as non-persistable with the existing invoice key", () => {
    const period = normalizeBillingPeriod({
      billingMode: "einzeln",
      billingDate: "2026-07-15",
    });

    expect(period.invoiceSupported).toBe(false);
    expect(period.billingQuarter).toBeNull();
    expect(period.billingMonth).toBeNull();
  });

  it("uses 14 current sessions as the initial draft when none is saved", () => {
    const sessions = Array.from({ length: 14 }, (_, index) =>
      session(`current-${index + 1}`, 100, false)
    );
    const [bundle] = calculateCoachBundles({
      sessions,
      coachTaxProfile: { business_country_code: "AT" },
    });
    const view = getCoachInvoiceDraftView({ invoice: null, calculatedBundle: bundle });

    expect(view.saved_draft).toBeNull();
    expect(view.primary_draft.line_items[0].qty).toBe(14);
    expect(view.current_calculation.session_count).toBe(14);
    expect(view.has_calculation_difference).toBe(false);
  });

  it("keeps a saved 16-session draft primary while current calculation is 14", () => {
    const view = getCoachInvoiceDraftView({
      invoice: {
        line_items: [{ description: "Provision", qty: 16, unit_price: 40, total: 640 }],
        total_net: 640,
        vat_amount: 0,
        total_gross: 640,
        invoice_with_vat: false,
        tax_treatment: "reverse_charge",
        tax_reason: "eu_uid_manually_confirmed",
        vat_rate: 0,
      },
      calculatedBundle: {
        bundle_type: "client_with_vat",
        bundle_key: "reverse_charge",
        session_ids: Array.from({ length: 14 }, (_, index) => `s-${index + 1}`),
        session_count: 14,
        rows: [{ label: "Provision", qty: 14, unit_price_net: 40, total_net: 560 }],
        subtotal_net: 560,
        vat_amount: 0,
        total_gross: 560,
        tax_treatment: "reverse_charge",
        tax_reason: "eu_uid_manually_confirmed",
        vat_rate: 0,
      },
    });

    expect(view.primary_draft.line_items[0].qty).toBe(16);
    expect(view.current_calculation.line_items[0].qty).toBe(14);
    expect(view.has_calculation_difference).toBe(true);
  });

  it("reports no difference when the saved draft equals the current calculation", () => {
    const view = getCoachInvoiceDraftView({
      invoice: {
        line_items: [{ description: "Berufstätig – Provision", qty: 14, unit_price: 40, total: 560 }],
        total_net: 560,
        vat_amount: 0,
        total_gross: 560,
        invoice_with_vat: false,
        tax_treatment: "reverse_charge",
        tax_reason: "eu_uid_manually_confirmed",
        vat_rate: 0,
      },
      calculatedBundle: {
        bundle_type: "client_with_vat",
        bundle_key: "reverse_charge",
        session_ids: Array.from({ length: 14 }, (_, index) => `s-${index + 1}`),
        session_count: 14,
        rows: [{ label: "Berufstätig", qty: 14, unit_price_net: 40, total_net: 560 }],
        subtotal_net: 560,
        vat_amount: 0,
        total_gross: 560,
        tax_treatment: "reverse_charge",
        tax_reason: "eu_uid_manually_confirmed",
        vat_rate: 0,
      },
    });

    expect(view.has_calculation_difference).toBe(false);
  });

  it("preserves manual draft fields until explicit recalculation", () => {
    const invoice = {
      invoice_number: "MANUAL-1",
      invoice_date: "2026-09-28",
      service_period: "Q3 2026",
      client_name: "Test Coach GmbH",
      salutation: "Hallo,",
      intro_text: "Manueller Text",
      payment_terms: "30 Tage",
      closing_text: "Danke",
      line_items: [{ description: "Manuell", qty: 16, unit_price: 41, total: 656 }],
      total_net: 656,
      vat_amount: 0,
      total_gross: 656,
      invoice_with_vat: false,
      tax_treatment: "reverse_charge",
      tax_reason: "manual",
      vat_rate: 0,
    };
    const view = getCoachInvoiceDraftView({
      invoice,
      calculatedBundle: {
        bundle_type: "client_with_vat",
        bundle_key: "reverse_charge",
        session_ids: ["s-1"],
        session_count: 1,
        rows: [{ label: "Auto", qty: 14, unit_price_net: 40, total_net: 560 }],
        subtotal_net: 560,
        vat_amount: 0,
        total_gross: 560,
        tax_treatment: "reverse_charge",
        tax_reason: "eu_uid_manually_confirmed",
        vat_rate: 0,
      },
    });

    expect(view.primary_draft).toMatchObject(invoice);
  });

  it("explicit recalculation replaces automatic values but preserves editorial fields", () => {
    const invoice = {
      invoice_number: "MANUAL-1",
      invoice_date: "2026-09-28",
      service_period: "Eigener Zeitraum",
      client_name: "Test Coach GmbH",
      salutation: "Hallo,",
      intro_text: "Manueller Text",
      payment_terms: "30 Tage",
      closing_text: "Danke",
      line_items: [{ description: "Manuell", qty: 16, unit_price: 41, total: 656 }],
      total_net: 656,
    };
    const recalculated = applyCurrentCalculationToDraft(invoice, {
      bundle_type: "client_with_vat",
      bundle_key: "reverse_charge",
      session_ids: Array.from({ length: 14 }, (_, index) => `s-${index + 1}`),
      session_count: 14,
      rows: [{ label: "Auto", qty: 14, unit_price_net: 40, total_net: 560 }],
      subtotal_net: 560,
      vat_amount: 0,
      total_gross: 560,
      tax_treatment: "reverse_charge",
      tax_reason: "eu_uid_manually_confirmed",
      vat_rate: 0,
    });

    expect(recalculated.line_items[0].qty).toBe(14);
    expect(recalculated.total_net).toBe(560);
    expect(recalculated.tax_treatment).toBe("reverse_charge");
    expect(recalculated).toMatchObject({
      invoice_number: "MANUAL-1",
      invoice_date: "2026-09-28",
      service_period: "Eigener Zeitraum",
      client_name: "Test Coach GmbH",
      salutation: "Hallo,",
      intro_text: "Manueller Text",
      payment_terms: "30 Tage",
      closing_text: "Danke",
    });
  });

  it("explicit recalculation carries review_required into the saved draft", () => {
    const recalculated = applyCurrentCalculationToDraft(
      {
        invoice_number: "MANUAL-1",
        line_items: [{ qty: 16, unit_price: 40, total: 640 }],
      },
      {
        bundle_type: "client_with_vat",
        bundle_key: "reverse_charge",
        session_ids: ["s-1"],
        session_count: 1,
        rows: [{ label: "Auto", qty: 1, unit_price_net: 40, total_net: 40 }],
        subtotal_net: 40,
        vat_amount: 0,
        total_gross: 40,
        tax_treatment: "review_required",
        tax_reason: "eu_uid_not_confirmed",
        vat_rate: 0,
      }
    );

    expect(recalculated).toMatchObject({
      invoice_number: "MANUAL-1",
      tax_treatment: "review_required",
      tax_reason: "eu_uid_not_confirmed",
      vat_rate: 0,
    });
  });

  it("invalidates manual UID confirmation when UID or business seat changes", () => {
    const current = {
      business_country_code: "DE",
      vat_number: "DE123456789",
    };

    expect(uidConfirmationNeedsInvalidation(current, current)).toBe(false);
    expect(
      uidConfirmationNeedsInvalidation(current, {
        ...current,
        vat_number: "DE987654321",
      })
    ).toBe(true);
    expect(
      uidConfirmationNeedsInvalidation(current, {
        ...current,
        business_country_code: "FR",
      })
    ).toBe(true);
  });
});