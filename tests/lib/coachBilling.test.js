import { describe, expect, it } from "vitest";
import {
  buildCoachBillingPeriod,
  calculateCoachBundles,
  getCoachInvoiceFinalizationAction,
  getCoachInvoiceView,
  resolveCoachInvoiceTax,
  serializeCoachInvoiceSnapshot,
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

  it("splits client VAT bundles and uses the coach rate for net commission", () => {
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

  it("uses the full German client price as commission basis without client VAT", () => {
    const [bundle] = calculateCoachBundles({
      sessions: [session("de-out", 100, false)],
      coachTaxProfile: {
        business_country_code: "DE",
        vat_number: "DE123456789",
        uid_confirmed_at: "2026-01-01T00:00:00.000Z",
        uid_confirmed_by: "admin-1",
        default_vat_rate: 19,
      },
    });

    expect(bundle.bundle_type).toBe("client_without_vat");
    expect(bundle.rows[0].unit_price_net).toBe(30);
    expect(bundle.tax_treatment).toBe("reverse_charge");
    expect(bundle.vat_rate).toBe(0);
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
        business_country_code: "DE",
        vat_number: "DE123456789",
      })
    ).toMatchObject({
      tax_treatment: "review_required",
      tax_reason: "eu_uid_not_confirmed",
    });
  });

  it("requires review for missing and third-country seats", () => {
    expect(resolveCoachInvoiceTax({}).tax_reason).toBe("business_country_missing");
    expect(
      resolveCoachInvoiceTax({ business_country_code: "CH", vat_number: "CHE123" })
        .tax_treatment
    ).toBe("review_required");
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

  it("keeps a serialized snapshot of session IDs and invoice values", () => {
    const [bundle] = calculateCoachBundles({
      sessions: [session("final-1", 100, false)],
      coachTaxProfile: { business_country_code: "AT" },
    });
    const snapshot = serializeCoachInvoiceSnapshot({
      coachId: "coach-1",
      billingPeriod: { start: "start", end: "end" },
      bundle,
      coachTaxProfile: { business_country_code: "AT" },
    });

    expect(snapshot.session_ids).toEqual(["final-1"]);
    expect(snapshot.sessions[0]).toMatchObject({
      session_id: "final-1",
      client_price: 100,
      client_with_vat: false,
      net_basis: 100,
      commission_net: 30,
    });
    expect(snapshot.line_items[0].qty).toBe(1);
    expect(snapshot.tax_treatment).toBe("vat");
  });

  it("recalculates an old draft quantity from current sessions", () => {
    const view = getCoachInvoiceView({
      invoice: {
        invoice_status: "draft",
        line_items: [{ qty: 16, unit_price: 40, total: 640 }],
        total_net: 640,
      },
      calculatedBundle: {
        rows: [{ label: "Berufstätig", qty: 14, unit_price_net: 40, total_net: 560 }],
        subtotal_net: 560,
        vat_amount: 112,
        total_gross: 672,
        tax_treatment: "vat",
        vat_rate: 20,
      },
    });

    expect(view.state).toBe("draft");
    expect(view.line_items[0].qty).toBe(14);
    expect(view.total_net).toBe(560);
  });

  it("keeps a finalized snapshot unchanged when current sessions differ", () => {
    const view = getCoachInvoiceView({
      invoice: {
        invoice_status: "finalized",
        line_items: [{ qty: 16, unit_price: 40, total: 640 }],
        total_net: 640,
      },
      calculatedBundle: {
        rows: [{ label: "Berufstätig", qty: 14, unit_price_net: 40, total_net: 560 }],
        subtotal_net: 560,
      },
    });

    expect(view.state).toBe("finalized");
    expect(view.line_items[0].qty).toBe(16);
    expect(view.total_net).toBe(640);
  });

  it("keeps the 14-session snapshot after finalization when current sessions drop", () => {
    const view = getCoachInvoiceView({
      invoice: {
        invoice_status: "finalized",
        line_items: [{ qty: 14, unit_price: 40, total: 560 }],
        total_net: 560,
      },
      calculatedBundle: {
        rows: [{ label: "Berufstätig", qty: 12, unit_price_net: 40, total_net: 480 }],
        subtotal_net: 480,
      },
    });

    expect(view.line_items[0].qty).toBe(14);
    expect(view.total_net).toBe(560);
  });

  it("keeps statusless legacy invoices read-only and unchanged", () => {
    const view = getCoachInvoiceView({
      invoice: {
        invoice_status: null,
        line_items: [{ qty: 16, unit_price: 40, total: 640 }],
        total_net: 640,
      },
      calculatedBundle: {
        rows: [{ label: "Berufstätig", qty: 14, unit_price_net: 40, total_net: 560 }],
        subtotal_net: 560,
      },
    });

    expect(view.state).toBe("legacy");
    expect(view.line_items[0].qty).toBe(16);
  });

  it("does not create a second invoice after finalization or for legacy records", () => {
    expect(getCoachInvoiceFinalizationAction(null)).toBe("create_final");
    expect(
      getCoachInvoiceFinalizationAction({ invoice_status: "draft" })
    ).toBe("finalize_draft");
    expect(
      getCoachInvoiceFinalizationAction({ invoice_status: "finalized" })
    ).toBe("return_final");
    expect(getCoachInvoiceFinalizationAction({ invoice_status: null })).toBe(
      "legacy_read_only"
    );
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