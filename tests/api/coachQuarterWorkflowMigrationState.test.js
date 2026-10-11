import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ready: false,
  member: { id: "admin-mock", role: "admin", active: true },
  queries: [],
  rpcCalls: [],
  writes: [],
  invoice: null,
  release: null,
}));

vi.mock("../../app/lib/coachQuarterWorkflowReadiness.js", async (importOriginal) => ({
  ...(await importOriginal()),
  getCoachQuarterWorkflowReadiness: vi.fn(async () => (
    mocks.ready ? { ready: true, reason: null } : { ready: false, reason: "schema_pending" }
  )),
}));

function createSupabaseMock() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-mock", email: "admin@example.invalid" } }, error: null }) },
    from(table) {
      const query = {
        select(columns) {
          mocks.queries.push({ table, columns });
          return query;
        },
        eq: () => query,
        is: () => query,
        order: () => query,
        maybeSingle: async () => ({
          data: table === "coach_quarter_releases"
            ? mocks.release
            : table === "team_members" ? mocks.member : mocks.invoice,
          error: null,
        }),
        single: async () => ({ data: mocks.member, error: null }),
        insert(payload) { mocks.writes.push({ table, op: "insert", payload }); return query; },
        update(payload) { mocks.writes.push({ table, op: "update", payload }); return query; },
      };
      return query;
    },
    rpc: async (name, args) => {
      mocks.rpcCalls.push({ name, args });
      if (name === "check_coach_invoice_link") return { data: "unlinked", error: null };
      if (name === "coach_quarter_snapshot") return { data: { sessions: [] }, error: null };
      return { data: null, error: null };
    },
  };
}

vi.mock("../../app/api/_lib/server.js", () => ({
  getUserFromBearer: vi.fn(async () => ({ user: { id: "user-mock" }, error: null })),
  json: (data, status = 200) => new Response(JSON.stringify(data), { status }),
  supabaseAdmin: () => createSupabaseMock(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => createSupabaseMock(),
}));

const contextMock = vi.hoisted(() => ({
  loadCoachBillingContext: vi.fn(),
  loadCoachInvoice: vi.fn(),
}));

vi.mock("../../app/api/invoices/_lib/coachInvoice", async (importOriginal) => ({
  ...(await importOriginal()),
  loadCoachBillingContext: contextMock.loadCoachBillingContext,
  loadCoachInvoice: contextMock.loadCoachInvoice,
}));
vi.mock("../../app/api/invoices/_lib/coachInvoice.js", async (importOriginal) => ({
  ...(await importOriginal()),
  loadCoachBillingContext: contextMock.loadCoachBillingContext,
  loadCoachInvoice: contextMock.loadCoachInvoice,
}));

import { GET as loadCoach } from "../../app/api/invoices/load-coach/route.js";
import { POST as saveCoach } from "../../app/api/invoices/save-coach/route.js";
import { POST as recalculateCoach } from "../../app/api/invoices/recalculate-coach/route.js";
import {
  GET as getQuarterRelease,
  POST as postQuarterRelease,
} from "../../app/api/therapist/quarter-release/route.js";
import { POST as createSevdeskDraft } from "../../app/api/sevdesk/create-and-send-coach-invoice/route.js";
import { POST as updateCoachInvoice } from "../../app/api/sevdesk/update-coach-invoice/route.js";
import { POST as syncPositions } from "../../app/api/sevdesk/sync-coach-invoice-positions/route.js";

const ENV_KEYS = [
  "SEVDESK_API_TOKEN",
  "SEVDESK_COACH_INVOICE_LIVE_ENABLED",
  "SEVDESK_COACH_INVOICE_TEST_COACH_ID",
];
const savedEnv = {};

function request(path, method = "GET", body) {
  return new Request(`https://app.example.invalid${path}`, {
    method,
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const quarterBody = {
  coach_id: "coach-mock",
  billing_mode: "quartal",
  billing_year: 2026,
  billing_quarter: 3,
  bundle_type: "client_without_vat",
  expected_updated_at: "2026-10-01T10:00:00.000Z",
};

describe("coach quarter workflow before and after migrations 08/09/11/12", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    process.env.SEVDESK_API_TOKEN = "test-token";
    delete process.env.SEVDESK_COACH_INVOICE_LIVE_ENABLED;
    delete process.env.SEVDESK_COACH_INVOICE_TEST_COACH_ID;
    mocks.ready = false;
    mocks.member = { id: "admin-mock", role: "admin", active: true };
    mocks.queries = [];
    mocks.rpcCalls = [];
    mocks.writes = [];
    mocks.invoice = {
      id: "invoice-mock",
      bundle_key: "quarter_bundle_mock",
      updated_at: "2026-10-01T10:00:00.000Z",
      line_items: [{ description: "Provision", qty: 1, unit_price: 10, total: 10 }],
      sevdesk_invoice_id: null,
    };
    mocks.release = {
      release_version: 2,
      release_status: "released",
      released_at: "2026-10-01T10:00:00Z",
      snapshot: { sessions: [] },
    };
    contextMock.loadCoachBillingContext.mockReset();
    contextMock.loadCoachBillingContext.mockResolvedValue({
      error: null,
      coach: { id: "coach-mock", profile_name: "Mock Coach", email: "coach@example.invalid" },
      coachTaxProfile: {},
      period: {
        billingMode: "quartal",
        billingYear: 2026,
        billingQuarter: 3,
        label: "Q3 2026",
        invoiceSupported: true,
      },
      bundles: [],
    });
    contextMock.loadCoachInvoice.mockReset();
    contextMock.loadCoachInvoice.mockImplementation(async () => ({ data: mocks.invoice, error: null }));
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  describe("before migrations", () => {
    it("keeps the admin invoice view readable without new tables or functions", async () => {
      const response = await loadCoach(request(
        "/api/invoices/load-coach?coachId=coach-mock&bundleType=client_without_vat&billingMode=quartal&billingYear=2026&billingQuarter=3"
      ));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        invoice_id: "invoice-mock",
        quarter_workflow_available: false,
        sevdesk_link_state: "unavailable",
        coach_quarter_release: null,
      });
      expect(body.quarter_workflow_message).toMatch(/noch nicht verfügbar/);
      expect(mocks.queries.some((q) => q.table === "coach_quarter_releases")).toBe(false);
      expect(mocks.rpcCalls).toEqual([]);
      expect(mocks.writes).toEqual([]);
    });

    it("returns a neutral coach notice instead of an error", async () => {
      mocks.member = { id: "coach-mock", role: "therapist", active: true };
      const response = await getQuarterRelease(request("/api/therapist/quarter-release?year=2026&quarter=3"));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({ available: false, release: null, session_count: 0 });
      expect(body.message).toMatch(/noch nicht verfügbar/);
      expect(mocks.rpcCalls).toEqual([]);
    });

    it("blocks the coach release server-side", async () => {
      mocks.member = { id: "coach-mock", role: "therapist", active: true };
      const response = await postQuarterRelease(request(
        "/api/therapist/quarter-release", "POST", { year: 2026, quarter: 3 }
      ));
      expect(response.status).toBe(503);
      expect((await response.json()).error).toBe("coach_quarter_workflow_unavailable");
      expect(mocks.rpcCalls).toEqual([]);
    });

    it("blocks saving before loading context or writing", async () => {
      const response = await saveCoach(request("/api/invoices/save-coach", "POST", quarterBody));
      expect(response.status).toBe(503);
      expect((await response.json()).error).toBe("coach_quarter_workflow_unavailable");
      expect(contextMock.loadCoachBillingContext).not.toHaveBeenCalled();
      expect(mocks.writes).toEqual([]);
      expect(mocks.rpcCalls).toEqual([]);
    });

    it("blocks recalculation before loading context or writing", async () => {
      const response = await recalculateCoach(request("/api/invoices/recalculate-coach", "POST", quarterBody));
      expect(response.status).toBe(503);
      expect((await response.json()).error).toBe("coach_quarter_workflow_unavailable");
      expect(contextMock.loadCoachBillingContext).not.toHaveBeenCalled();
      expect(mocks.writes).toEqual([]);
    });

    it("blocks sevDesk draft creation even if the live gate were configured", async () => {
      process.env.SEVDESK_COACH_INVOICE_LIVE_ENABLED = "true";
      process.env.SEVDESK_COACH_INVOICE_TEST_COACH_ID = "coach-mock";
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const response = await createSevdeskDraft(request(
        "/api/sevdesk/create-and-send-coach-invoice", "POST", { coachInvoiceId: "invoice-mock" }
      ));
      expect(response.status).toBe(503);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mocks.writes).toEqual([]);
      expect(mocks.rpcCalls).toEqual([]);
      fetchSpy.mockRestore();
    });

    it("keeps legacy sevDesk write syncs disabled", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      for (const handler of [updateCoachInvoice, syncPositions]) {
        const response = await handler(request("/api/sevdesk/legacy", "POST", { coachInvoiceId: "invoice-mock" }));
        expect(response.status).toBe(409);
      }
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mocks.writes).toEqual([]);
      fetchSpy.mockRestore();
    });
  });

  describe("after migrations", () => {
    beforeEach(() => {
      mocks.ready = true;
    });

    it("loads release state and link state for the admin view", async () => {
      const response = await loadCoach(request(
        "/api/invoices/load-coach?coachId=coach-mock&bundleType=client_without_vat&billingMode=quartal&billingYear=2026&billingQuarter=3"
      ));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        quarter_workflow_available: true,
        quarter_workflow_message: null,
        sevdesk_link_state: "unlinked",
        coach_quarter_release: { release_version: 2, release_status: "released" },
      });
      expect(mocks.rpcCalls.map((call) => call.name)).toEqual([
        "coach_quarter_snapshot",
        "check_coach_invoice_link",
      ]);
      expect(mocks.writes).toEqual([]);
    });

    it("reads the stored snapshot for the coach release status", async () => {
      mocks.member = { id: "coach-mock", role: "therapist", active: true };
      const response = await getQuarterRelease(request("/api/therapist/quarter-release?year=2026&quarter=3"));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        available: true,
        release: { release_status: "released", release_version: 2 },
      });
      const releaseQuery = mocks.queries.find((q) => q.table === "coach_quarter_releases");
      expect(releaseQuery.columns).toContain("snapshot");
    });

    it("lets save reach the existing business checks", async () => {
      const response = await saveCoach(request("/api/invoices/save-coach", "POST", quarterBody));
      expect(response.status).not.toBe(503);
      expect(contextMock.loadCoachBillingContext).toHaveBeenCalledTimes(1);
    });

    it("still keeps sevDesk creation closed without the server-side live gate", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const response = await createSevdeskDraft(request(
        "/api/sevdesk/create-and-send-coach-invoice", "POST", { coachInvoiceId: "invoice-mock" }
      ));
      expect(response.status).toBe(503);
      expect((await response.json()).error).toBe("sevdesk_live_workflow_blocked");
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });
});
