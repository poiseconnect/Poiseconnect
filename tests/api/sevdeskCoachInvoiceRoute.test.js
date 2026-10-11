import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: null,
  member: null,
  coach: null,
  taxProfile: null,
  invoice: null,
  release: null,
  rpcCalls: [],
  updates: [],
  linkState: "unlinked",
}));

vi.mock("../../app/lib/coachQuarterWorkflowReadiness.js", async (importOriginal) => ({
  ...(await importOriginal()),
  getCoachQuarterWorkflowReadiness: vi.fn(async () => ({ ready: true, reason: null })),
}));

vi.mock("../../app/api/_lib/server.js", () => ({
  getUserFromBearer: vi.fn(async () => ({ user: mocks.user, error: "NO_TOKEN" })),
  json: (data, status = 200) => new Response(JSON.stringify(data), { status }),
  supabaseAdmin: () => createMockSupabase(),
}));

vi.mock("../../app/api/invoices/_lib/coachInvoice.js", () => ({
  loadCoachBillingContext: vi.fn(async () => ({
    error: null,
    bundles: [{
      bundle_type: "client_without_vat",
      calculation_errors: [],
      rows: [{ qty: 2, unit_price_net: 50, total_net: 100 }],
      subtotal_net: 100,
      vat_amount: 20,
      total_gross: 120,
    }],
  })),
}));

import {
  GET,
  POST,
} from "../../app/api/sevdesk/create-and-send-coach-invoice/route.js";
import { POST as legacyQuarterlyExport } from "../../app/api/sevdesk-export-coach-quarterly/route.js";

const taxConfig = {
  confirmed: true,
  systemVersion: "2.0",
  treatments: {
    vat: {
      taxRule: { id: "tax-vat-mock", objectName: "TaxRule" },
      legacyTaxType: "default",
      positionTaxRate: 20,
      taxText: "VAT",
    },
    reverse_charge: {
      taxRule: { id: "tax-rc-mock", objectName: "TaxRule" },
      legacyTaxType: "eu",
      positionTaxRate: 0,
      taxText: "Reverse charge",
    },
  },
  countryMappings: {
    AT: { id: "country-mock", aliases: ["AT", "Österreich"] },
  },
  coachContactMappings: [
    { coachId: "coach-mock", contactId: "contact-mock", addressConfirmed: true },
  ],
  contactPerson: { id: "sev-user-mock", objectName: "SevUser" },
};

function request(method = "POST", path = "/api/sevdesk/create-and-send-coach-invoice") {
  return new Request(`https://app.example.invalid${path}`, {
    method,
    headers: { Authorization: "Bearer mock-user-token", "Content-Type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify({ coachInvoiceId: "draft-mock" }) } : {}),
  });
}

function createMockSupabase() {
  return {
    from(table) {
      return {
        select() {
          const query = { filters: [] };
          query.eq = (key, value) => { query.filters.push([key, value]); return query; };
          query.maybeSingle = async () => ({ data: selectRow(table, query.filters), error: null });
          query.single = async () => ({ data: selectRow(table, query.filters), error: null });
          return query;
        },
        update(payload) {
          const query = { filters: [], payload };
          for (const method of ["eq", "is", "in"]) {
            query[method] = (key, value) => { query.filters.push([method, key, value]); return query; };
          }
          query.select = () => query;
          query.maybeSingle = async () => {
            const target = selectRow(table, query.filters.map(([, key, value]) => [key, value]));
            mocks.updates.push({ table, payload, target });
            if (!target) return { data: null, error: null };
            Object.assign(target, payload);
            return { data: { id: target.id }, error: null };
          };
          return query;
        },
      };
    },
    rpc(name, args) {
      mocks.rpcCalls.push({ name, args });
      return Promise.resolve({ data: name === "check_coach_invoice_link" ? mocks.linkState : "reserved", error: null });
    },
  };
}

function selectRow(table, filters) {
  const id = filters.find(([key]) => key === "id")?.[1];
  if (table === "team_members") {
    return filters.some(([key]) => key === "user_id") ? mocks.member : mocks.coach;
  }
  if (table === "therapist_invoice_settings") return mocks.taxProfile;
  if (table === "coach_invoices") return String(mocks.invoice?.id) === String(id) ? mocks.invoice : null;
  if (table === "coach_quarter_releases") return mocks.release;
  return null;
}

describe("sevDesk Poise-to-coach draft API", () => {
  beforeEach(() => {
    mocks.user = { id: "user-admin-mock" };
    mocks.member = { id: "admin-mock", role: "admin", active: true };
    mocks.coach = {
      id: "coach-mock",
      active: true,
      role: "therapist",
      email: "coach@example.invalid",
      profile_name: "Mock Coach GmbH",
      sevdesk_contact_id: "contact-mock",
    };
    mocks.taxProfile = {
      company_name: "Mock Coach GmbH",
      address: "Mockgasse 1\n1010 Wien",
      business_country_code: "AT",
      default_vat_rate: 20,
    };
    mocks.invoice = {
      id: "draft-mock",
      coach_id: "coach-mock",
      billing_mode: "quartal",
      billing_year: 2026,
      billing_quarter: 3,
      coach_quarter_release_version: 3,
      updated_at: "2026-10-01T12:00:00.000Z",
      bundle_key: "normal_ust",
      service_period: "Q3 2026",
      invoice_date: "2026-10-01",
      client_name: "Mock Coach GmbH",
      client_street: "Mockgasse 1",
      client_city: "1010 Wien",
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
      line_items: [{ description: "Saved line item", qty: 2, unit_price: 50, total: 100 }],
      sevdesk_invoice_id: null,
      sevdesk_send_status: null,
    };
    mocks.release = {
      release_status: "released",
      release_version: 3,
    };
    mocks.rpcCalls = [];
    mocks.updates = [];
    mocks.linkState = "unlinked";
    vi.stubEnv("SEVDESK_COACH_INVOICE_LIVE_ENABLED", "true");
    vi.stubEnv("SEVDESK_COACH_INVOICE_API_SCHEMA_CONFIRMED", "true");
    vi.stubEnv("SEVDESK_COACH_INVOICE_TEST_COACH_ID", "coach-mock");
    vi.stubEnv("SEVDESK_COACH_INVOICE_TAX_CONFIG", JSON.stringify(taxConfig));
    vi.stubEnv("SEVDESK_API_TOKEN", "mock-provider-token");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requires an authenticated active admin", async () => {
    mocks.user = null;
    expect((await POST(request())).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["135675889", "135833778"])("blocks historical external identity %s without writes", async (externalId) => {
    mocks.invoice.sevdesk_invoice_id = externalId;
    mocks.invoice.sevdesk_send_status = "created";
    mocks.linkState = "quarantined";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await POST(request());
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: "sevdesk_invoice_link_conflict" });
      expect(fetch).not.toHaveBeenCalled();
      expect(mocks.updates).toEqual([]);
      expect(JSON.stringify(log.mock.calls)).not.toContain(externalId);
    } finally {
      log.mockRestore();
    }
  });

  it("creates a sevDesk draft without finalizing, sending, or deriving a final number", async () => {
    fetch.mockImplementation(async (url, options = {}) => {
      if (String(url).endsWith("/Tools/bookkeepingSystemVersion")) {
        return providerResponse({ objects: { version: "2.0" } });
      }
      if (String(url).endsWith("/Contact/contact-mock")) {
        return providerResponse({ objects: [{ name: "Mock Coach GmbH" }] });
      }
      if (String(url).includes("/CommunicationWay?")) {
        return providerResponse({ objects: [{ type: "EMAIL", value: "coach@example.invalid" }] });
      }
      if (String(url).includes("/Invoice?")) {
        return providerResponse({ objects: [] });
      }
      if (String(url).endsWith("/Invoice/Factory/saveInvoice") && options.method === "POST") {
        return providerResponse({ invoice: { id: "sevdesk-invoice-mock", invoiceNumber: "TEMP-001" } }, 201);
      }
      throw new Error("Unexpected provider call");
    });

    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      ok: true,
      invoiceId: "sevdesk-invoice-mock",
      draftInvoiceNumber: "TEMP-001",
      sendStatus: "created",
    });
    const creationCalls = fetch.mock.calls.filter(([url]) =>
      String(url).includes("/Invoice/Factory/saveInvoice")
    );
    expect(creationCalls).toHaveLength(1);
    const payload = JSON.parse(creationCalls[0][1].body);
    expect(payload.invoice.status).toBe("100");
    expect(payload.invoicePosSave[0]).toMatchObject({
      name: "Saved line item",
      quantity: 2,
      price: 50,
      taxRate: 20,
    });
    expect(fetch.mock.calls.some(([url]) =>
      /sendViaEmail|enshrine|\/InvoicePos/.test(String(url))
    )).toBe(false);
    expect(mocks.invoice).toMatchObject({
      sevdesk_invoice_id: "sevdesk-invoice-mock",
      sevdesk_draft_invoice_number: "TEMP-001",
      sevdesk_send_status: "created",
    });
    expect(mocks.rpcCalls.map((call) => call.name))
      .toEqual(["check_coach_invoice_link", "reserve_coach_invoice_creation"]);
  });

  it("blocks a matching unlinked sevDesk invoice after a read-only contact scan", async () => {
    fetch.mockImplementation(async (url, options = {}) => {
      if (String(url).endsWith("/Tools/bookkeepingSystemVersion")) {
        return providerResponse({ objects: { version: "2.0" } });
      }
      if (String(url).endsWith("/Contact/contact-mock")) {
        return providerResponse({ objects: [{ name: "Mock Coach GmbH" }] });
      }
      if (String(url).includes("/CommunicationWay?")) {
        return providerResponse({ objects: [{ type: "EMAIL", value: "coach@example.invalid" }] });
      }
      if (String(url).includes("/Invoice?")) {
        return providerResponse({
          objects: [{
            id: "unlinked-invoice",
            contact: { id: "contact-mock", objectName: "Contact" },
            header: "Provision Q3 2026",
            customerInternalNote: "3. Quartal 2026",
          }],
        });
      }
      if (String(url).includes("/getPositions?")) {
        return providerResponse({
          objects: [{
            name: "Saved line item",
            quantity: 2,
            price: 50,
            taxRate: 20,
          }],
        });
      }
      throw new Error("Unexpected provider call");
    });

    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "sevdesk_period_invoice_exists",
    });
    expect(fetch.mock.calls.some(([url]) =>
      String(url).includes("/Invoice/Factory/saveInvoice")
    )).toBe(false);
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/getPositions?")))
      .toBe(true);
    expect(mocks.invoice).toMatchObject({
      sevdesk_send_status: "creation_unknown",
      sevdesk_send_error_code: "sevdesk_period_invoice_exists",
    });
  });

  it("reads every sevDesk invoice page before allowing creation", async () => {
    fetch.mockImplementation(async (url, options = {}) => {
      if (String(url).endsWith("/Tools/bookkeepingSystemVersion")) {
        return providerResponse({ objects: { version: "2.0" } });
      }
      if (String(url).endsWith("/Contact/contact-mock")) {
        return providerResponse({ objects: [{ name: "Mock Coach GmbH" }] });
      }
      if (String(url).includes("/CommunicationWay?")) {
        return providerResponse({ objects: [{ type: "EMAIL", value: "coach@example.invalid" }] });
      }
      if (String(url).includes("/Invoice?") && String(url).includes("offset=0")) {
        return providerResponse({
          objects: Array.from({ length: 1000 }, (_, index) => ({
            id: `other-period-${index}`,
            contact: { id: "contact-mock", objectName: "Contact" },
            header: "Provision Q2 2026",
            customerInternalNote: "2. Quartal 2026",
            deliveryDate: "2026-03-31T22:00:00.000Z",
            deliveryDateUntil: "2026-06-30T22:00:00.000Z",
          })),
        });
      }
      if (String(url).includes("/Invoice?") && String(url).includes("offset=1000")) {
        return providerResponse({ objects: [] });
      }
      if (String(url).endsWith("/Invoice/Factory/saveInvoice") && options.method === "POST") {
        return providerResponse({ invoice: { id: "sevdesk-invoice-paged" } }, 201);
      }
      throw new Error("Unexpected provider call");
    });

    const response = await POST(request());
    expect(response.status).toBe(201);
    const invoicePages = fetch.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.includes("/Invoice?"));
    expect(invoicePages).toHaveLength(2);
    expect(invoicePages[0]).toContain("limit=1000");
    expect(invoicePages[0]).toContain("offset=0");
    expect(invoicePages[1]).toContain("offset=1000");
  });

  it("reads the existing sevDesk invoice through GET only", async () => {
    mocks.invoice.sevdesk_invoice_id = "sevdesk-invoice-mock";
    mocks.invoice.sevdesk_send_status = "created";
    fetch.mockImplementation(async (url, options = {}) => {
      expect(options.method).toBeUndefined();
      return providerResponse({
        objects: [{
          id: "sevdesk-invoice-mock",
          status: "100",
          invoiceNumber: "TEMP-001",
        }],
      });
    });
    const response = await GET(request(
      "GET",
      "/api/sevdesk/create-and-send-coach-invoice?coachInvoiceId=draft-mock"
    ));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      invoiceId: "sevdesk-invoice-mock",
      invoiceStatus: "100",
      invoiceNumber: "TEMP-001",
      isDraft: true,
    });
    expect(mocks.updates).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the legacy calculated-bundle export decommissioned", async () => {
    const response = await legacyQuarterlyExport(request());
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "saved_coach_invoice_required" });
  });
});

function providerResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status });
}
