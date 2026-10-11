import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "auth-coach-mock" },
  member: { id: "coach-mock", role: "therapist", active: true },
  release: null,
  snapshot: { sessions: [{ id: "session-mock" }] },
  rpcCalls: [],
}));

vi.mock("../../app/lib/coachQuarterWorkflowReadiness.js", async (importOriginal) => ({
  ...(await importOriginal()),
  getCoachQuarterWorkflowReadiness: vi.fn(async () => ({ ready: true, reason: null })),
}));

vi.mock("../../app/api/_lib/server.js", () => ({
  getUserFromBearer: vi.fn(async () => ({ user: mocks.user, error: "NO_TOKEN" })),
  json: (data, status = 200) => new Response(JSON.stringify(data), { status }),
  supabaseAdmin: () => ({
    from(table) {
      const query = {
        eq: () => query,
        maybeSingle: async () => ({
          data: table === "coach_quarter_releases" ? mocks.release : mocks.member,
          error: null,
        }),
        single: async () => ({ data: mocks.member, error: null }),
      };
      return { select: () => query };
    },
    rpc: async (name, args) => {
      mocks.rpcCalls.push({ name, args });
      if (name === "coach_quarter_snapshot") return { data: mocks.snapshot, error: null };
      return { data: { release_version: 4, release_status: "released" }, error: null };
    },
  }),
}));

import {
  GET,
  POST,
} from "../../app/api/therapist/quarter-release/route.js";

describe("therapist quarterly billing release", () => {
  beforeEach(() => {
    mocks.user = { id: "auth-coach-mock" };
    mocks.member = { id: "coach-mock", role: "therapist", active: true };
    mocks.release = {
      release_version: 3,
      release_status: "released",
      snapshot: { sessions: [{ id: "session-mock" }] },
      released_at: "2026-10-01T10:00:00Z",
    };
    mocks.snapshot = { sessions: [{ id: "session-mock" }] };
    mocks.rpcCalls = [];
  });

  it("returns a release only after checking current source data", async () => {
    const response = await GET(request(
      "GET",
      "/api/therapist/quarter-release?year=2026&quarter=3"
    ));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      release: { release_status: "released", release_version: 3 },
    });
    expect(mocks.rpcCalls[0]).toMatchObject({
      name: "coach_quarter_snapshot",
      args: {
        p_coach_id: "coach-mock",
        p_billing_year: 2026,
        p_billing_quarter: 3,
      },
    });
  });

  it("marks an outdated snapshot stale without mutating it", async () => {
    mocks.snapshot = { sessions: [{ id: "changed-session-mock" }] };
    const response = await GET(request(
      "GET",
      "/api/therapist/quarter-release?year=2026&quarter=3"
    ));
    expect((await response.json()).release.release_status).toBe("stale");
    expect(mocks.rpcCalls).toHaveLength(1);
  });

  it("releases only the authenticated coach's selected quarter", async () => {
    const response = await POST(new Request(
      "https://app.example.invalid/api/therapist/quarter-release",
      {
        method: "POST",
        headers: { Authorization: "Bearer mock-token", "Content-Type": "application/json" },
        body: JSON.stringify({ year: 2026, quarter: 3, coach_id: "another-coach-mock" }),
      }
    ));
    expect(response.status).toBe(200);
    expect(mocks.rpcCalls).toEqual([{
      name: "release_coach_quarter",
      args: {
        p_coach_id: "coach-mock",
        p_billing_year: 2026,
        p_billing_quarter: 3,
        p_released_by: "coach-mock",
      },
    }]);
  });

  it("rejects admins and invalid quarters before any release RPC", async () => {
    mocks.member = { id: "admin-mock", role: "admin", active: true };
    const denied = await POST(new Request(
      "https://app.example.invalid/api/therapist/quarter-release",
      { method: "POST", headers: { Authorization: "Bearer mock-token" }, body: "{}" }
    ));
    expect(denied.status).toBe(403);
    expect(mocks.rpcCalls).toEqual([]);
  });
});

function request(method, url) {
  return new Request(`https://app.example.invalid${url}`, {
    method,
    headers: { Authorization: "Bearer mock-token" },
  });
}
