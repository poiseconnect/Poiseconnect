import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: null,
  rpcResult: { data: { deleted: true }, error: null },
  calls: [],
}));

vi.mock("../../app/api/_lib/server.js", () => ({
  getActiveTeamMember: async () => state.auth,
  json: (body, status = 200) => Response.json(body, { status }),
}));

import { POST } from "../../app/api/requests/delete-forever/route.js";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN = { id: "synthetic-admin-id", role: "admin", active: true };

function request(body) {
  return new Request("https://app.example.invalid/api/requests/delete-forever", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setup({ member = ADMIN, result = { data: { deleted: true }, error: null } } = {}) {
  state.auth = { member, supabase: { rpc: vi.fn(async (...args) => {
    state.calls.push(args);
    return result;
  }) } };
  state.rpcResult = result;
}

describe("transactional permanent request deletion route", () => {
  beforeEach(() => {
    state.calls = [];
    setup();
  });

  it("remains active-admin-only and does not call an RPC for other roles", async () => {
    setup({ member: { ...ADMIN, role: "therapist" } });
    const response = await POST(request({ requestId: REQUEST_ID }));
    expect(response.status).toBe(403);
    expect(state.calls).toEqual([]);
  });

  it.each([
    [{}, "missing_requestId"],
    [{ requestId: "../not-a-uuid" }, "invalid_requestId"],
    [{ requestId: 7 }, "invalid_requestId"],
  ])("rejects malformed identifiers before database mutation", async (body, error) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error });
    expect(state.calls).toEqual([]);
  });

  it("calls only the transaction RPC with the trusted admin member identity", async () => {
    const response = await POST(request({ requestId: REQUEST_ID }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(state.calls).toEqual([[
      "privacy_delete_request",
      { p_request_id: REQUEST_ID, p_actor_id: ADMIN.id },
    ]]);
  });

  it("returns categorized retention blockers without success-shaped fallback", async () => {
    setup({ result: { data: {
      deleted: false,
      code: "REQUEST_DELETE_BLOCKED",
      blockers: ["HEALTH_CONSENT_RETENTION", "BILLING_RETENTION"],
    }, error: null } });

    const response = await POST(request({ requestId: REQUEST_ID }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "REQUEST_DELETE_BLOCKED",
      blockers: ["HEALTH_CONSENT_RETENTION", "BILLING_RETENTION"],
    });
  });

  it("reports unclassified FK blockers after the atomic RPC rolls back", async () => {
    setup({ result: { data: null, error: {
      code: "23503", message: "synthetic unknown FK",
    } } });

    const response = await POST(request({ requestId: REQUEST_ID }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "REQUEST_DELETE_BLOCKED",
      blockers: ["UNCLASSIFIED_DATABASE_DEPENDENCY"],
    });
  });

  it("fails closed when the deletion RPC is missing, denied, or returns malformed data", async () => {
    for (const result of [
      { data: null, error: { code: "42883", message: "function missing" } },
      { data: null, error: { code: "42501", message: "permission denied" } },
      { data: { ok: true }, error: null },
    ]) {
      setup({ result });
      const response = await POST(request({ requestId: REQUEST_ID }));
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "REQUEST_DELETE_UNAVAILABLE" });
    }
  });
});
