import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { buildSevdeskPeriodFields } from "../../app/lib/coachInvoiceDraft.js";

const state = vi.hoisted(() => ({ link: "unique", admin: true, user: true }));
vi.mock("../../app/api/_lib/server.js", () => ({
  getUserFromBearer: async () => ({ user: state.user ? { id: "synthetic-user" } : null }),
  json: (data, status = 200) => new Response(JSON.stringify(data), { status }),
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: state.admin ? { role: "admin", active: true } : null, error: null,
      }) }) }),
    }),
    rpc: async () => ({ data: state.link, error: null }),
  }),
}));
import { POST as updateHead } from "../../app/api/sevdesk/update-coach-invoice/route.js";
import { POST as updatePositions } from "../../app/api/sevdesk/sync-coach-invoice-positions/route.js";

function request() {
  return new Request("https://example.invalid/api/sevdesk/update-coach-invoice", {
    method: "POST", body: JSON.stringify({ coachInvoiceId: "synthetic-draft" }),
  });
}

describe("retired coach invoice write sync", () => {
  beforeEach(() => {
    state.link = "unique"; state.admin = true; state.user = true;
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it.each([updateHead, updatePositions])("blocks all external writes, including unique historical NULL-status links", async (route) => {
    const response = await route(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "sevdesk_write_sync_disabled" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["ambiguous", "quarantined"])("returns a specific conflict for %s in both sync routes", async (link) => {
    state.link = link;
    for (const route of [updateHead, updatePositions]) {
      const response = await route(request());
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: "sevdesk_invoice_link_conflict" });
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(console.error.mock.calls)).not.toContain("synthetic-draft");
  });

  it("blocks unknown schema and preserves authorization", async () => {
    state.link = null;
    expect((await updateHead(request())).status).toBe(503);
    state.user = false;
    expect((await updateHead(request())).status).toBe(401);
    state.user = true; state.admin = false;
    expect((await updatePositions(request())).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("removes the write controls and makes the ID readonly without removing read access", () => {
    const ui = readFileSync(new URL("../../app/dashboard/rechnung-coach/[coachId]/page.jsx", import.meta.url), "utf8");
    expect(ui).not.toMatch(/sendAllToSevdesk|syncInvoicePositionsToSevdesk|updateInvoiceInSevdesk/);
    expect(ui).toMatch(/value=\{sevdeskInvoiceId\}\s+readOnly/);
    expect(ui).toContain("onClick={readSevdeskStatus}");
    expect(ui).toContain("onClick={exportPDF}");
  });
});

describe("preserved invoice period calculation", () => {
  it.each([
    [2026, 1, "2026-01-01", "2026-03-31"],
    [2026, 2, "2026-04-01", "2026-06-30"],
    [2026, 3, "2026-07-01", "2026-09-30"],
    [2026, 4, "2026-10-01", "2026-12-31"],
  ])("preserves Vienna boundaries for %s Q%s", (year, quarter, start, end) => {
    const fields = buildSevdeskPeriodFields({
      billing_mode: "quartal", billing_year: year, billing_quarter: quarter,
      service_period: `Q${quarter} ${year}`,
    });
    const format = (value) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(new Date(value));
    expect(format(fields.deliveryDate)).toBe(start);
    expect(format(fields.deliveryDateUntil * 1000)).toBe(end);
  });
});
