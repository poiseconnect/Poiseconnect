import { describe, expect, it } from "vitest";
import { buildEditableCoachInvoicePayload } from "../../app/lib/coachInvoiceDraft.js";
import {
  applyCurrentCalculationToDraft,
  calculateCoachBundles,
  getCoachInvoiceDraftView,
} from "../../app/lib/coachBilling.js";

const period = {
  billingMode: "quartal",
  billingYear: 2026,
  billingQuarter: 3,
  billingMonth: null,
  label: "Q3 2026",
};

const manualDraft = {
  coach_id: "coach-1",
  invoice_number: "POISE-MANUAL-1",
  invoice_date: "2026-09-28",
  service_period: "Eigener Leistungszeitraum",
  customer_number: "K-1",
  contact_person: "Test Admin",
  client_name: "Test Coach GmbH",
  client_street: "Teststraße 1",
  client_city: "1010 Teststadt",
  client_country: "Österreich",
  client_email: "coach@example.invalid",
  salutation: "Hallo,",
  intro_text: "Manueller Einleitungstext",
  payment_terms: "30 Tage",
  closing_text: "Danke",
  invoice_with_vat: false,
  tax_treatment: "reverse_charge",
  tax_reason: "eu_uid_manually_confirmed",
  vat_rate: 0,
  total_net: 656,
  vat_amount: 0,
  total_gross: 656,
  line_items: [
    {
      id: "manual-1",
      pos: 1,
      description: "Manuelle Provision",
      qty: 16,
      unit_price: 41,
      total: 656,
    },
  ],
};

describe("editable coach invoice draft", () => {
  it("normal save preserves manual quantity, price, totals and editorial fields", () => {
    const payload = buildEditableCoachInvoicePayload({
      body: manualDraft,
      existing: null,
      period,
      bundleType: "client_with_vat",
      updatedBy: "admin-1",
      updatedAt: "2026-09-28T10:00:00.000Z",
    });

    expect(payload.line_items).toEqual(manualDraft.line_items);
    expect(payload).toMatchObject({
      total_net: 656,
      total_gross: 656,
      invoice_number: "POISE-MANUAL-1",
      service_period: "Eigener Leistungszeitraum",
      client_name: "Test Coach GmbH",
      intro_text: "Manueller Einleitungstext",
      payment_terms: "30 Tage",
      tax_treatment: "reverse_charge",
    });
  });

  it("reload keeps the saved 16-session draft over a current 14-session calculation", () => {
    const payload = buildEditableCoachInvoicePayload({
      body: manualDraft,
      existing: null,
      period,
      bundleType: "client_with_vat",
      updatedBy: "admin-1",
      updatedAt: "2026-09-28T10:00:00.000Z",
    });
    const view = getCoachInvoiceDraftView({
      invoice: payload,
      calculatedBundle: {
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
      },
    });

    expect(view.primary_draft.line_items[0].qty).toBe(16);
    expect(view.primary_draft.line_items[0].unit_price).toBe(41);
    expect(view.primary_draft.total_net).toBe(656);
    expect(view.current_calculation.session_count).toBe(14);
    expect(view.has_calculation_difference).toBe(true);
  });

  it("does not alter a saved tax treatment on load, but explicit recalculation updates it", () => {
    const saved = {
      ...manualDraft,
      invoice_with_vat: false,
      tax_treatment: "reverse_charge",
      tax_reason: "old_saved_tax",
      vat_rate: 0,
      total_net: 60,
      total_gross: 60,
      line_items: [{
        id: "saved",
        description: "Gespeichert",
        qty: 1,
        unit_price: 60,
        total: 60,
      }],
    };
    const [currentBundle] = calculateCoachBundles({
      sessions: [{
        id: "without-vat-session",
        price: 200,
        anfragen: { invoice_with_vat: false },
      }],
      coachTaxProfile: {
        business_country_code: "DE",
        vat_number: "DE123456789",
        uid_confirmed_at: "2026-01-01T00:00:00.000Z",
        uid_confirmed_by: "admin-1",
        default_vat_rate: 19,
      },
    });
    const loaded = getCoachInvoiceDraftView({
      invoice: saved,
      calculatedBundle: currentBundle,
    });

    expect(loaded.primary_draft.tax_treatment).toBe("reverse_charge");
    expect(loaded.primary_draft.vat_rate).toBe(0);
    expect(loaded.current_calculation.tax_treatment).toBe("vat");
    expect(loaded.current_calculation.vat_rate).toBe(20);
    expect(loaded.has_calculation_difference).toBe(true);

    const recalculated = applyCurrentCalculationToDraft(saved, currentBundle);
    expect(recalculated.line_items[0].qty).toBe(1);
    expect(recalculated.total_net).toBe(60);
    expect(recalculated.tax_treatment).toBe("vat");
    expect(recalculated.vat_rate).toBe(20);
    expect(recalculated.vat_amount).toBe(12);
    expect(recalculated.total_gross).toBe(72);
    expect(recalculated.invoice_number).toBe(saved.invoice_number);
    expect(recalculated.payment_terms).toBe(saved.payment_terms);
  });

  it("preserves existing sevDesk metadata during an ordinary save", () => {
    const payload = buildEditableCoachInvoicePayload({
      body: { ...manualDraft, sevdesk_invoice_id: null },
      existing: {
        sevdesk_invoice_id: "sevdesk-1",
        sevdesk_invoice_number: "RE-1",
        sevdesk_synced_at: "2026-09-27T10:00:00.000Z",
      },
      period,
      bundleType: "client_with_vat",
      updatedBy: "admin-1",
      updatedAt: "2026-09-28T10:00:00.000Z",
    });

    expect(payload).toMatchObject({
      sevdesk_invoice_id: "sevdesk-1",
      sevdesk_invoice_number: "RE-1",
      sevdesk_synced_at: "2026-09-27T10:00:00.000Z",
    });
  });
});