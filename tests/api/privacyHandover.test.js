import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "synthetic-user" },
  member: { id: "synthetic-coach-a", role: "therapist", active: true },
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock("../../app/api/_lib/server", () => ({
  getUserFromBearer: async () => ({ user: mocks.user }),
  supabaseAdmin: () => ({ from: mocks.from, rpc: mocks.rpc }),
  json: (body, status = 200) => Response.json(body, { status }),
}));

import { POST } from "../../app/api/coach-handover/route.js";

const operationId = "11111111-1111-4111-8111-111111111111";
const body = {
  anfrageId: "synthetic-request", handoverType: "therapist_change",
  expectedCareVersion: 4, operationId,
};
const request = (value = body) => new Request("https://app.example.invalid/api/coach-handover", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value),
});

describe("atomic handover API contract (no database or providers)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "synthetic-user" };
    mocks.member = { id: "synthetic-coach-a", role: "therapist", active: true };
    mocks.from.mockImplementation((table) => {
      expect(table).toBe("team_members");
      const chain = { select: () => chain, eq: () => chain,
        single: async () => ({ data: mocks.member, error: null }) };
      return chain;
    });
    mocks.rpc.mockResolvedValue({ data: { ok: true, mode: "existing",
      requestId: body.anfrageId, careVersion: 5, sensitiveDataAccessRequired: true }, error: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("uses only the atomic RPC, never copies a request or rewrites session/invoice/calendar data", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, mode: "existing",
      requestId: body.anfrageId, careVersion: 5, sensitiveDataAccessRequired: true });
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("privacy_handover_request", {
      p_request_id: body.anfrageId, p_actor_id: "synthetic-coach-a",
      p_handover_type: "therapist_change", p_target_coach_id: null,
      p_expected_version: 4, p_operation_id: operationId,
    });
  });

  it.each([
    ["FUTURE_APPOINTMENTS_REQUIRE_DECISION", 409],
    ["CARE_OPERATION_IN_PROGRESS", 409],
    ["CARE_VERSION_CONFLICT", 409],
    ["IDEMPOTENCY_CONFLICT", 409],
    ["NO_ACCESS", 403],
    ["REQUEST_NOT_FOUND", 404],
  ])("returns an explicit %s without a legacy-write fallback", async (code, status) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: code } });
    const response = await POST(request());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, -1, "4", 1.5])("requires an explicit integer care version (%s)", async (expectedCareVersion) => {
    const response = await POST(request({ ...body, expectedCareVersion }));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires a stable operation ID", async () => {
    const response = await POST(request({ ...body, operationId: null }));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["PGRST202", "42501"])("fails closed when the prepared database contract is unavailable (%s)", async (code) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "private-db-detail" } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private-db-detail");
  });

  it.each(["support", ""])("rejects other active roles (%s)", async (role) => {
    mocks.member.role = role;
    expect((await POST(request())).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not trust an actor ID supplied by the caller", async () => {
    await POST(request({ ...body, actorId: "spoofed-admin" }));
    expect(mocks.rpc.mock.calls[0][1].p_actor_id).toBe("synthetic-coach-a");
  });
});
