import { describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import {
  buildSevdeskCoachInvoicePayload,
  executeCoachInvoiceCreate,
  loadCoachInvoiceAutomationConfig,
  readCoachInvoiceStatus,
  validateCoachInvoiceDraft,
} from "../../app/lib/coachInvoiceSevdesk.js";

const taxConfig = {
  confirmed: true,
  systemVersion: "2.0",
  treatments: {
    vat: {
      taxRule: { id: "mock-vat-rule", objectName: "TaxRule" },
      legacyTaxType: "default",
      positionTaxRate: 20,
      taxText: "Mock VAT",
    },
    reverse_charge: {
      taxRule: { id: "mock-reverse-charge-rule", objectName: "TaxRule" },
      legacyTaxType: "eu",
      positionTaxRate: 0,
      taxText: "Mock reverse charge",
    },
  },
  countryMappings: {
    AT: { id: "country-test", aliases: ["AT", "Österreich"] },
  },
  coachContactMappings: [
    { coachId: "coach-test", contactId: "contact-test", addressConfirmed: true },
  ],
  contactPerson: { id: "sev-user-test", objectName: "SevUser" },
};
const enabledConfig = { enabled: true, testCoachId: "coach-test", taxConfig };

const invoice = {
  id: "draft-test",
  coach_id: "coach-test",
  billing_mode: "quartal",
  billing_year: 2026,
  billing_quarter: 3,
  coach_quarter_release_version: 2,
  updated_at: "2026-10-01T12:00:00.000Z",
  bundle_key: "normal_ust",
  service_period: "Q3 2026",
  invoice_date: "2026-10-01",
  client_name: "Test Coach GmbH",
  client_street: "Testgasse 1",
  client_city: "4810 Gmunden",
  client_country: "Österreich",
  client_email: "coach@example.invalid",
  salutation: "Guten Tag",
  intro_text: "Leistung laut Vereinbarung",
  payment_terms: "Zahlung innerhalb von 14 Tagen ab Rechnungseingang.",
  closing_text: "Vielen Dank",
  tax_treatment: "vat",
  tax_reason: "client_without_vat_bundle_poise_vat",
  invoice_with_vat: true,
  vat_rate: 20,
  total_net: 100,
  vat_amount: 20,
  total_gross: 120,
  line_items: [
    { description: "Gespeicherte Position", qty: 2, unit_price: 50, total: 100 },
  ],
};

const coach = {
  id: "coach-test",
  email: "coach@example.invalid",
  profile_name: "Test Coach GmbH",
  sevdesk_contact_id: "contact-test",
  sevdesk_country_id: "country-test",
};

describe("Poise coach invoice sevDesk draft workflow", () => {
  it("keeps the removed unauthenticated test-update route absent", () => {
    expect(existsSync(new URL("../../app/api/sevdesk/test-update-invoice/route.js", import.meta.url))).toBe(false);
  });

  it.each(["ambiguous", "quarantined"])("blocks %s links even for an already-created invoice", async (state) => {
    const workflow = makeWorkflow({
      draftOverrides: { sevdesk_invoice_id: "135675889", sevdesk_send_status: "created" },
    });
    workflow.repository.getLinkState.mockResolvedValue(state);
    expect(await executeCoachInvoiceCreate(workflow.input))
      .toMatchObject({ status: 409, error: "sevdesk_invoice_link_conflict" });
    expect(workflow.provider.createInvoice).not.toHaveBeenCalled();
    expect(workflow.provider.getBookkeepingSystemVersion).not.toHaveBeenCalled();
  });

  it("fails closed if the reservation response is missing", async () => {
    const workflow = makeWorkflow({ reservation: undefined });
    workflow.repository.reserveCreation.mockResolvedValue({});
    expect(await executeCoachInvoiceCreate(workflow.input)).toMatchObject({ status: 409 });
    expect(workflow.provider.createInvoice).not.toHaveBeenCalled();
    workflow.repository.reserveCreation.mockResolvedValue(null);
    expect(await executeCoachInvoiceCreate(workflow.input)).toMatchObject({ status: 409 });
    expect(workflow.provider.createInvoice).not.toHaveBeenCalled();
  });

  it("keeps a returned provider ID for reconciliation after persistence failure", async () => {
    const workflow = makeWorkflow();
    workflow.repository.saveCreated.mockResolvedValue(false);
    expect(await executeCoachInvoiceCreate(workflow.input))
      .toMatchObject({ status: 500, error: "invoice_created_but_persistence_failed" });
    expect(workflow.repository.markCreationUnknown).toHaveBeenCalledWith(
      "draft-test", "invoice_created_but_persistence_failed", "sevdesk-invoice-test"
    );
  });

  it("requires confirmed account tax mappings before enabling creation", () => {
    expect(loadCoachInvoiceAutomationConfig({})).toMatchObject({
      enabled: false,
      reason: "live_disabled",
    });
    expect(loadCoachInvoiceAutomationConfig({
      SEVDESK_COACH_INVOICE_LIVE_ENABLED: "true",
      SEVDESK_COACH_INVOICE_API_SCHEMA_CONFIRMED: "true",
      SEVDESK_COACH_INVOICE_TAX_CONFIG: JSON.stringify(taxConfig),
      SEVDESK_COACH_INVOICE_TEST_COACH_ID: "coach-test",
    })).toMatchObject({ enabled: true });
    expect(loadCoachInvoiceAutomationConfig({
      SEVDESK_COACH_INVOICE_LIVE_ENABLED: "true",
      SEVDESK_COACH_INVOICE_API_SCHEMA_CONFIRMED: "true",
      SEVDESK_COACH_INVOICE_TAX_CONFIG: JSON.stringify(taxConfig),
    })).toMatchObject({ enabled: false, reason: "test_coach_not_configured" });
  });

  it("builds a status-100 draft solely from saved Poise invoice values", () => {
    const payload = buildSevdeskCoachInvoicePayload(
      invoice,
      {
        ...coach,
        business_country_code: "AT",
        address: "Testgasse 1\n4810 Gmunden",
      },
      enabledConfig
    );
    expect(payload.invoice).toMatchObject({
      status: "100",
      taxRule: taxConfig.treatments.vat.taxRule,
      header: "Provision Q3 2026",
      headText: "Guten Tag\n\nLeistung laut Vereinbarung",
      deliveryDate: "2026-06-30T22:00:00.000Z",
      customerInternalNote: "3. Quartal 2026",
    });
    expect(payload.invoicePosSave[0]).toMatchObject({
      name: "Gespeicherte Position",
      quantity: 2,
      price: 50,
      taxRate: 20,
    });
  });

  it("uses confirmed coach-to-business tax facts for the separate reverse-charge case", () => {
    const reverseChargeConfig = {
      ...enabledConfig,
      taxConfig: {
        ...taxConfig,
        countryMappings: {
          ...taxConfig.countryMappings,
          DE: { id: "country-de-test", aliases: ["DE", "Deutschland"] },
        },
      },
    };
    const reverseChargeInvoice = {
      ...invoice,
      bundle_key: "reverse_charge",
      client_country: "Deutschland",
      tax_treatment: "reverse_charge",
      tax_reason: "eu_uid_manually_confirmed",
      invoice_with_vat: false,
      vat_rate: 0,
      vat_amount: 0,
      total_gross: 100,
    };
    const confirmedTaxProfile = {
      business_country_code: "DE",
      vat_number: "DE-MOCK-UID",
      uid_confirmed_at: "2026-10-01T00:00:00.000Z",
      uid_confirmed_by: "admin-mock",
    };
    const coachWithGermanContact = {
      ...coach,
      business_country_code: "DE",
      sevdesk_country_id: "country-de-test",
    };
    const result = validateCoachInvoiceDraft(
      reverseChargeInvoice,
      coachWithGermanContact,
      reverseChargeConfig,
      confirmedTaxProfile
    );
    expect(result.error).toBeNull();
    expect(buildSevdeskCoachInvoicePayload(
      reverseChargeInvoice,
      { ...coachWithGermanContact, ...confirmedTaxProfile },
      reverseChargeConfig
    ).invoice.taxRule).toEqual(taxConfig.treatments.reverse_charge.taxRule);

    expect(validateCoachInvoiceDraft(
      reverseChargeInvoice,
      coachWithGermanContact,
      reverseChargeConfig,
      { business_country_code: "DE", vat_number: "DE-MOCK-UID" }
    ).error).toBe("tax_treatment_does_not_match_coach_draft");
  });

  it.each([
    [{ tax_treatment: "review_required" }, "tax_treatment_unconfirmed"],
    [{ tax_reason: "other" }, "tax_treatment_does_not_match_coach_draft"],
    [{ vat_rate: 0 }, "tax_treatment_does_not_match_coach_draft"],
    [{ sevdesk_invoice_id: "manual-invoice" }, "manually_linked_invoice_blocked"],
    [{ sevdesk_send_status: "creation_unknown" }, "manual_reconciliation_required"],
  ])("blocks unsafe draft values %#", (overrides, expectedError) => {
    expect(validateCoachInvoiceDraft(
      { ...invoice, ...overrides },
      { ...coach, business_country_code: "AT" },
      enabledConfig
    ).error).toBe(expectedError);
  });

  it("creates one unsent draft and persists only its sevDesk identity", async () => {
    const workflow = makeWorkflow();
    const result = await executeCoachInvoiceCreate(workflow.input);
    expect(result).toMatchObject({
      status: 201,
      invoiceId: "sevdesk-invoice-test",
      draftInvoiceNumber: "DRAFT-001",
      sendStatus: "created",
    });
    expect(workflow.provider.createInvoice).toHaveBeenCalledTimes(1);
    expect(workflow.provider.createInvoice.mock.calls[0][0].invoice.status).toBe("100");
    expect(workflow.provider.sendInvoice).toBeUndefined();
    expect(workflow.repository.saveCreated).toHaveBeenCalledWith({
      invoiceId: "draft-test",
      sevdeskInvoiceId: "sevdesk-invoice-test",
      draftInvoiceNumber: "DRAFT-001",
    });
  });

  it("blocks coaches outside the server-side test-coach allowlist before provider calls", async () => {
    const workflow = makeWorkflow({
      draftOverrides: { coach_id: "another-coach" },
    });
    expect(await executeCoachInvoiceCreate(workflow.input))
      .toMatchObject({ status: 403, error: "test_coach_not_allowed" });
    expect(workflow.provider.getBookkeepingSystemVersion).not.toHaveBeenCalled();
    expect(workflow.provider.createInvoice).not.toHaveBeenCalled();
  });

  it("blocks an existing same-bundle sevDesk invoice and leaves the operation non-retryable", async () => {
    const currentBundle = {
      calculation_errors: [],
      subtotal_net: 100,
      vat_amount: 20,
      total_gross: 120,
      tax_treatment: "vat",
      rows: [{
        description: "Gespeicherte Position",
        qty: 2,
        unit_price_net: 50,
        total_net: 100,
      }],
    };
    const workflow = makeWorkflow({ bundle: currentBundle });
    workflow.repository.getCurrentBundle.mockImplementation(async (candidate) =>
      candidate.bundle_key === "normal_ust" ? currentBundle : {
        tax_treatment: "reverse_charge",
        rows: [{ description: "Other", qty: 1, unit_price_net: 30 }],
      }
    );
    workflow.provider.findInvoicesForQuarter.mockResolvedValue([{
      id: "existing-sevdesk",
      __poisePeriodMatch: "same_period",
    }]);
    workflow.provider.getInvoicePositions.mockResolvedValue([
      { name: "Gespeicherte Position", quantity: 2, price: 50, taxRate: 20 },
    ]);
    const result = await executeCoachInvoiceCreate(workflow.input);
    expect(result).toMatchObject({ status: 409, error: "sevdesk_period_invoice_exists" });
    expect(workflow.repository.markCreationUnknown).toHaveBeenCalledWith(
      "draft-test",
      "sevdesk_period_invoice_exists"
    );
    expect(workflow.provider.createInvoice).not.toHaveBeenCalled();
  });

  it("allows the other known billing bundle but never an ambiguous period invoice", async () => {
    const workflow = makeWorkflow();
    const siblingBundle = {
      tax_treatment: "reverse_charge",
      rows: [{ description: "Other bundle", qty: 1, unit_price_net: 30 }],
    };
    workflow.repository.getCurrentBundle.mockImplementation(async (candidate) =>
      candidate.bundle_key === "reverse_charge" ? siblingBundle : workflow.bundle
    );
    workflow.provider.findInvoicesForQuarter.mockResolvedValue([{
      id: "sibling-sevdesk",
      __poisePeriodMatch: "same_period",
    }]);
    workflow.provider.getInvoicePositions.mockResolvedValue([
      { name: "Other bundle", quantity: 1, price: 30, taxRate: 0 },
    ]);
    expect(await executeCoachInvoiceCreate(workflow.input))
      .toMatchObject({ status: 201, sendStatus: "created" });
    expect(workflow.provider.createInvoice).toHaveBeenCalledTimes(1);
  });

  it("uses the atomic reservation as the parallel-request winner", async () => {
    let reservationTaken = false;
    const workflow = makeWorkflow();
    workflow.repository.reserveCreation.mockImplementation(async () => {
      if (reservationTaken) return { status: "already_reserved" };
      reservationTaken = true;
      return { status: "reserved" };
    });
    const results = await Promise.all([
      executeCoachInvoiceCreate(workflow.input),
      executeCoachInvoiceCreate(workflow.input),
    ]);
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.error === "invoice_operation_already_reserved"))
      .toHaveLength(1);
    expect(workflow.provider.createInvoice).toHaveBeenCalledTimes(1);
  });

  it("does not create if the coach release or saved bundle is stale", async () => {
    const staleRelease = makeWorkflow({ release: { release_status: "stale", release_version: 2 } });
    expect(await executeCoachInvoiceCreate(staleRelease.input))
      .toMatchObject({ status: 409, error: "coach_quarter_release_stale" });
    expect(staleRelease.provider.createInvoice).not.toHaveBeenCalled();

    const changedBundle = makeWorkflow({
      bundle: { rows: [{ qty: 3, unit_price_net: 50, total_net: 150 }] },
    });
    expect(await executeCoachInvoiceCreate(changedBundle.input))
      .toMatchObject({ status: 409, error: "saved_draft_does_not_match_released_sessions" });
    expect(changedBundle.provider.createInvoice).not.toHaveBeenCalled();
  });

  it("does not create when the atomic reservation detects a race or stale release", async () => {
    const alreadyReserved = makeWorkflow({ reservation: { status: "reserved_elsewhere" } });
    expect(await executeCoachInvoiceCreate(alreadyReserved.input))
      .toMatchObject({ status: 409, error: "invoice_operation_already_reserved" });
    expect(alreadyReserved.provider.createInvoice).not.toHaveBeenCalled();

    const stale = makeWorkflow({ reservation: { status: "stale" } });
    expect(await executeCoachInvoiceCreate(stale.input))
      .toMatchObject({ status: 409, error: "coach_quarter_release_stale" });
    expect(stale.provider.createInvoice).not.toHaveBeenCalled();
  });

  it("blocks repeat creation after an unknown external result", async () => {
    const workflow = makeWorkflow({
      createError: new Error("timeout"),
    });
    expect(await executeCoachInvoiceCreate(workflow.input))
      .toMatchObject({ status: 502, error: "invoice_creation_result_unknown" });
    expect(workflow.repository.markCreationUnknown).toHaveBeenCalledWith("draft-test");
    workflow.draft.sevdesk_send_status = "creation_unknown";
    expect(await executeCoachInvoiceCreate(workflow.input))
      .toMatchObject({ status: 409, error: "manual_reconciliation_required" });
    expect(workflow.provider.createInvoice).toHaveBeenCalledTimes(1);
  });

  it.each([400, 401])(
    "requires reconciliation after sevDesk error HTTP %s",
    async (status) => {
      const workflow = makeWorkflow({
        createError: Object.assign(new Error("rejected"), { status }),
      });
      expect(await executeCoachInvoiceCreate(workflow.input)).toMatchObject({
        status: 502,
        error: "invoice_creation_result_unknown",
        providerStatus: status,
      });
      expect(workflow.repository.markCreationFailed).not.toHaveBeenCalled();
      expect(workflow.repository.markCreationUnknown).toHaveBeenCalledWith("draft-test");
    }
  );

  it.each([409, 500])(
    "blocks retries after ambiguous sevDesk response HTTP %s",
    async (status) => {
      const workflow = makeWorkflow({
        createError: Object.assign(new Error("provider response"), { status }),
      });
      expect(await executeCoachInvoiceCreate(workflow.input)).toMatchObject({
        status: 502,
        error: "invoice_creation_result_unknown",
        providerStatus: status,
      });
      expect(workflow.repository.markCreationUnknown).toHaveBeenCalledWith("draft-test");
      expect(workflow.repository.markCreationFailed).not.toHaveBeenCalled();
    }
  );

  it("blocks creation when the read-only duplicate scan is incomplete", async () => {
    const workflow = makeWorkflow();
    workflow.provider.findInvoicesForQuarter.mockRejectedValue(new Error("timeout"));
    expect(await executeCoachInvoiceCreate(workflow.input)).toMatchObject({
      status: 502,
      error: "sevdesk_duplicate_check_unavailable",
    });
    expect(workflow.repository.markCreationUnknown).toHaveBeenCalledWith(
      "draft-test",
      "sevdesk_duplicate_check_unavailable"
    );
    expect(workflow.provider.createInvoice).not.toHaveBeenCalled();
  });

  it("reads status without changing the saved invoice", async () => {
    const repository = { getDraft: vi.fn(async () => ({
      ...invoice,
      sevdesk_invoice_id: "sevdesk-invoice-test",
    })) };
    const provider = { getInvoice: vi.fn(async () => ({
      id: "sevdesk-invoice-test",
      status: "100",
      invoiceNumber: "DRAFT-001",
    })) };
    await expect(readCoachInvoiceStatus({
      invoiceId: "draft-test",
      repository,
      provider,
    })).resolves.toMatchObject({
      status: 200,
      invoiceStatus: "100",
      invoiceNumber: "DRAFT-001",
      isDraft: true,
    });
    expect(provider.getInvoice).toHaveBeenCalledWith("sevdesk-invoice-test");
    expect(repository.getDraft).toHaveBeenCalledTimes(1);
  });
});

function makeWorkflow({
  draftOverrides = {},
  taxProfileOverrides = {},
  release = { release_status: "released", release_version: 2 },
  bundle = {
    calculation_errors: [],
    rows: [{ qty: 2, unit_price_net: 50, total_net: 100 }],
    subtotal_net: 100,
    vat_amount: 20,
    total_gross: 120,
  },
  reservation = { status: "reserved" },
  createError = null,
  created = { objects: { id: "sevdesk-invoice-test", invoiceNumber: "DRAFT-001" } },
} = {}) {
  const draft = { ...invoice, ...draftOverrides };
  const repository = {
    getLinkState: vi.fn(async () => "unlinked"),
    getDraft: vi.fn(async () => draft),
    getCoach: vi.fn(async () => ({
      coach,
      taxProfile: {
        company_name: "Test Coach GmbH",
        address: "Testgasse 1\n4810 Gmunden",
        business_country_code: "AT",
        default_vat_rate: 20,
        ...taxProfileOverrides,
      },
    })),
    getQuarterRelease: vi.fn(async () => release),
    getCurrentBundle: vi.fn(async () => bundle),
    reserveCreation: vi.fn(async () => reservation),
    getCurrentBundle: vi.fn(async () => bundle),
    markCreationUnknown: vi.fn(async () => true),
    markCreationFailed: vi.fn(async () => true),
    saveCreated: vi.fn(async () => true),
  };
  const provider = {
    getBookkeepingSystemVersion: vi.fn(async () => "2.0"),
    getContact: vi.fn(async () => ({ name: "Test Coach GmbH" })),
    getContactEmails: vi.fn(async () => [{ type: "EMAIL", value: "coach@example.invalid" }]),
    findInvoicesForQuarter: vi.fn(async () => []),
    getInvoicePositions: vi.fn(async () => []),
    createInvoice: vi.fn(async () => {
      if (createError) throw createError;
      return created;
    }),
  };
  return {
    draft,
    bundle,
    repository,
    provider,
    input: {
      invoiceId: "draft-test",
      adminId: "admin-test",
      repository,
      provider,
      config: enabledConfig,
    },
  };
}
