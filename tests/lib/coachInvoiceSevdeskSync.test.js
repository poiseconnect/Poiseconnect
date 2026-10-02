import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transform } from "next/dist/build/swc";
import { buildSevdeskPeriodFields, getSevdeskSyncErrorMessage } from "../../app/lib/coachInvoiceDraft.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const state = vi.hoisted(() => ({ invoice: null, updates: [], tables: [] }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { email: "admin@example.invalid" } }, error: null }) },
    from: (table) => {
      state.tables.push(table);
      return {
        select: () => ({ eq: () => ({ single: async () => ({
          data: table === "team_members" ? { id: "admin-test", role: "admin", active: true } : state.invoice,
          error: null,
        }) }) }),
        update: (payload) => ({ eq: async (field, id) => {
          state.updates.push({ payload, field, id });
          return { error: null };
        } }),
      };
    },
  }),
}));
import { POST } from "../../app/api/sevdesk/update-coach-invoice/route.js";
import { POST as syncPositions } from "../../app/api/sevdesk/sync-coach-invoice-positions/route.js";

function request() {
  return new Request("https://app.example.invalid/api/sevdesk/update-coach-invoice", {
    method: "POST", headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify({ coachInvoiceId: "draft-test", billing_quarter: 2, service_period: "Q2 2026" }),
  });
}
function draft(overrides = {}) {
  return {
    id: "draft-test", sevdesk_invoice_id: "invoice-test", sevdesk_invoice_number: "RE-TEST",
    billing_mode: "quartal", billing_year: 2026, billing_quarter: 3,
    service_period: "Q3 2026", intro_text: "Test introduction", payment_terms: "14 days", closing_text: "Test closing",
    ...overrides,
  };
}

describe("stored coach draft sevDesk metadata", () => {
  beforeEach(() => {
    state.invoice = draft(); state.updates = []; state.tables = [];
    vi.stubEnv("SEVDESK_API_TOKEN", "test-provider-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ objects: {} }), { status: 200 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it.each([
    [2026, 1, "2026-01-01", "2026-03-31"], [2026, 2, "2026-04-01", "2026-06-30"],
    [2026, 3, "2026-07-01", "2026-09-30"], [2026, 4, "2026-10-01", "2026-12-31"],
    [2027, 1, "2027-01-01", "2027-03-31"],
  ])("uses inclusive Vienna boundaries for %s Q%s", (year, quarter, start, end) => {
    const fields = buildSevdeskPeriodFields(draft({ billing_year: year, billing_quarter: quarter, service_period: `Q${quarter} ${year}` }));
    const dateInVienna = (value) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(new Date(value));
    expect(dateInVienna(fields.deliveryDate)).toBe(start);
    expect(dateInVienna(fields.deliveryDateUntil * 1000)).toBe(end);
    expect(fields.customerInternalNote).toBe(`${quarter}. Quartal ${year}`);
  });

  it("updates only permitted fields from the stored Q3 draft, never frontend period values", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("https://my.sevdesk.de/api/v1/Invoice/Factory/saveInvoice");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ invoice: {
      id: "invoice-test", objectName: "Invoice", header: "Provision Q3 2026",
      headText: "Test introduction", footText: "14 days\n\nTest closing",
      deliveryDate: "2026-06-30T22:00:00.000Z",
      deliveryDateUntil: Date.parse("2026-09-30T00:00:00+02:00") / 1000,
      customerInternalNote: "3. Quartal 2026",
    } });
    expect(state.tables).not.toContain("sessions");
    expect(state.invoice.sevdesk_invoice_number).toBe("RE-TEST");
    expect(state.updates[0].payload).not.toHaveProperty("sevdesk_invoice_id");
    expect(state.updates[0].payload).not.toHaveProperty("sevdesk_invoice_number");
  });

  it.each([
    { billing_year: null }, { billing_quarter: null }, { billing_quarter: 5 },
    { billing_month: null, billing_mode: "monat" }, { billing_year: "" },
    { billing_year: 2026.5 }, { billing_mode: "unknown" },
    { service_period: "Q2 2026" }, { service_period: "3. Quartal 2025" },
    { service_period: "01.04.2026 - 30.06.2026" },
    { service_period: "2026-04-01 - 2026-06-30" }, { service_period: "Q5 2026" },
  ])("rejects invalid or conflicting periods before any provider write: %j", async (overrides) => {
    state.invoice = draft(overrides);
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect((await response.json()).message).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    expect(state.updates).toEqual([]);
  });

  it.each([
    [{ billing_mode: "monat", billing_month: 3, billing_year: 2024, service_period: "3/2024" }, "2024-03-01", "2024-03-31"],
    [{ billing_mode: "monat", billing_month: 2, billing_year: 2024, service_period: "2/2024" }, "2024-02-01", "2024-02-29"],
    [{ billing_mode: "jahr", service_period: "2026" }, "2026-01-01", "2026-12-31"],
  ])("preserves monthly/yearly workflows and their reference: %j", (overrides, start, end) => {
    const fields = buildSevdeskPeriodFields(draft(overrides));
    const dateInVienna = (value) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(new Date(value));
    expect(dateInVienna(fields.deliveryDate)).toBe(start);
    expect(dateInVienna(fields.deliveryDateUntil * 1000)).toBe(end);
    expect(fields).not.toHaveProperty("customerInternalNote");
  });

  it("allows editorial labels without guessing a different period", () => {
    expect(buildSevdeskPeriodFields(draft({ service_period: "Individuelle Abrechnung" })).customerInternalNote).toBe("3. Quartal 2026");
  });

  it.each(["UTC", "America/Los_Angeles", "Europe/Vienna"])("does not depend on server timezone %s", (timezone) => {
    vi.stubEnv("TZ", timezone);
    expect(buildSevdeskPeriodFields(draft())).toMatchObject({
      deliveryDate: "2026-06-30T22:00:00.000Z",
      deliveryDateUntil: Date.parse("2026-09-30T00:00:00+02:00") / 1000,
    });
  });

  it.each(["3. Quartal 2026", "01.07.2026 - 30.09.2026", "2026-07-01 - 2026-09-30"])("accepts a matching explicit period %s", (label) => {
    expect(buildSevdeskPeriodFields(draft({ service_period: label })).customerInternalNote).toBe("3. Quartal 2026");
  });

  it("keeps the existing position replacement sourced only from stored draft values", async () => {
    state.invoice = draft({ invoice_with_vat: true, vat_rate: 20, line_items: [{ description: "Test provision", qty: 5, unit_price: 37.82, total: 189.10 }] });
    fetch.mockImplementation(async (url) => new Response(JSON.stringify({ objects: url.includes("InvoicePos?") ? [{ id: "old-position-test" }] : {} })));
    const response = await syncPositions(request());
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(3);
    const [load, remove, create] = fetch.mock.calls;
    expect(load[0]).toContain("invoice[id]=invoice-test");
    expect(remove[0]).toBe("https://my.sevdesk.de/api/v1/InvoicePos/old-position-test");
    expect(remove[1].method).toBe("DELETE");
    expect(create[0]).toBe("https://my.sevdesk.de/api/v1/InvoicePos");
    const fields = new URLSearchParams(create[1].body);
    expect(Object.fromEntries(fields)).toMatchObject({
      "invoice[id]": "invoice-test", quantity: "5", price: "37.82", taxRate: "20",
    });
    expect(state.tables).not.toContain("sessions");
  });

  it("returns a safe error on provider failure without recording success", async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ secret: "private-provider-detail" }), { status: 422 }));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private-provider-detail");
    expect(state.updates).toEqual([]);
  });
});

describe("coach invoice page combined sync", () => {
  let pageCode;
  beforeAll(async () => {
    const source = readFileSync(new URL("../../app/dashboard/rechnung-coach/[coachId]/page.jsx", import.meta.url), "utf8");
    pageCode = (await transform(source, {
      filename: "page.jsx",
      jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "automatic" } } },
      module: { type: "commonjs" },
    })).code;
  });

  function renderSyncButton(fetchMock, savedId = null) {
    let hookIndex = 0;
    const alerts = vi.fn();
    const stateChanges = [];
    const element = (type, props) => ({ type, props });
    const module = { exports: {} };
    const react = {
      useEffect: () => {}, useMemo: (calculate) => calculate(),
      useState: (initial) => {
        const index = hookIndex++;
        const value = index === 0 ? false : index === 4 ? savedId : index === 5 ? "invoice-test" : index === 8 ? { id: "coach-test" } : initial === "review_required" ? "vat" : initial;
        return [value, (next) => stateChanges.push({ index, next })];
      },
    };
    runInNewContext(pageCode, {
      module, exports: module.exports, fetch: fetchMock, alert: alerts, URLSearchParams,
      console: { error: vi.fn() },
      require: (name) => {
        if (name === "react") return react;
        if (name === "react/jsx-runtime") return { jsx: element, jsxs: element };
        if (name.includes("lib/supabase")) return { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "test-token" } } }) } } };
        if (name.includes("coachInvoiceDraft")) return { getSevdeskSyncErrorMessage };
        if (name === "jspdf" || name === "jspdf-autotable") return {};
        throw new Error(`Unexpected module: ${name}`);
      },
    });
    const tree = module.exports.default({ params: { coachId: "coach-test" }, searchParams: { billingYear: "2026", billingQuarter: "3" } });
    function findButton(node) {
      if (!node || typeof node !== "object") return null;
      if (node.type === "button" && node.props.children === "Alles zu sevDesk") return node;
      const children = Array.isArray(node) ? node : [node.props?.children];
      for (const child of children) {
        const found = findButton(child);
        if (found) return found;
      }
      return null;
    }
    return { button: findButton(tree), alerts, stateChanges };
  }

  function mockPageFetch(failingStep = null, saveId = "fresh-draft-test") {
    return vi.fn(async (url) => {
      if (url === "/api/invoices/save-coach") return new Response(JSON.stringify({ ok: true, data: { id: saveId } }));
      if (url.startsWith("/api/invoices/load-coach")) return new Response(JSON.stringify({ lineItems: [], tax_treatment: "vat" }));
      if (url === failingStep) return new Response(JSON.stringify({ ok: false, error: "server_error", detail: "private-provider-detail" }), { status: 500 });
      return new Response(JSON.stringify({ ok: true }));
    });
  }

  it.each([null, "stale-draft-test"])("uses the fresh saved ID for both steps, not captured state %s", async (oldId) => {
    const fetchMock = mockPageFetch();
    const { button, alerts } = renderSyncButton(fetchMock, oldId);
    await button.props.onClick();
    const writes = fetchMock.mock.calls.filter(([url]) => url.startsWith("/api/sevdesk/"));
    expect(writes).toHaveLength(2);
    for (const [, options] of writes) expect(JSON.parse(options.body)).toEqual({ coachInvoiceId: "fresh-draft-test" });
    expect(alerts).toHaveBeenCalledTimes(1);
    expect(alerts.mock.calls[0][0]).toContain("Alles erfolgreich");
  });

  it.each(["/api/sevdesk/update-coach-invoice", "/api/sevdesk/sync-coach-invoice-positions"])("propagates failure in %s without success or reloading inputs", async (step) => {
    const fetchMock = mockPageFetch(step);
    const { button, alerts, stateChanges } = renderSyncButton(fetchMock);
    await button.props.onClick();
    expect(alerts).toHaveBeenCalledTimes(1);
    expect(alerts.mock.calls[0][0]).not.toContain("Alles erfolgreich");
    expect(alerts.mock.calls[0][0]).not.toContain("private-provider-detail");
    expect(fetchMock.mock.calls.some(([url]) => url.startsWith("/api/invoices/load-coach"))).toBe(false);
    expect(stateChanges.every(({ index }) => [1, 3, 4, 5, 6, 7, 28].includes(index))).toBe(true);
    if (step.includes("update-coach")) expect(fetchMock.mock.calls.some(([url]) => url.includes("sync-coach-invoice-positions"))).toBe(false);
  });

  it("does not fall back to an old draft ID when save returns no ID", async () => {
    const fetchMock = mockPageFetch(null, null);
    const { button, alerts } = renderSyncButton(fetchMock, "stale-draft-test");
    await button.props.onClick();
    expect(fetchMock.mock.calls.some(([url]) => url.startsWith("/api/sevdesk/"))).toBe(false);
    expect(alerts.mock.calls[0][0]).not.toContain("Alles erfolgreich");
  });
});