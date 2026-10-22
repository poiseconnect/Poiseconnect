import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: null,
  requestRow: {
    id: "request-1",
    assigned_therapist_id: "coach-a",
  },
  reads: [],
  writes: [],
  updateResult: { data: { id: "request-1" }, error: null },
  supabase: null,
}));

vi.mock("../../app/api/_lib/server.js", () => ({
  getActiveTeamMember: async () => state.auth,
  canAccessAssignedRequest: (member, assignedId) =>
    member?.active === true &&
    (member.role === "admin" ||
      (member.role === "therapist" && member.id === assignedId)),
  json: (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
}));

import { POST } from "../../app/api/update-meeting-link-override/route.js";

function makeRequest(body) {
  return new Request("https://app.example.invalid/api/update-meeting-link-override", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createSupabase() {
  return {
    from(table) {
      const filters = [];
      let isUpdate = false;
      const query = {
        select(columns) {
          query.selectedColumns = columns;
          return query;
        },
        eq(column, value) {
          filters.push([column, value]);
          return query;
        },
        maybeSingle: async () => {
          state.reads.push({ table, filters: [...filters] });
          return isUpdate
            ? state.updateResult
            : { data: state.requestRow, error: null };
        },
        update(payload) {
          isUpdate = true;
          state.writes.push({ table, payload, filters });
          return query;
        },
      };
      return query;
    },
  };
}

describe("meeting link override access control", () => {
  beforeEach(() => {
    state.auth = {
      member: { id: "coach-a", role: "therapist", active: true },
      supabase: createSupabase(),
      error: null,
      status: 200,
    };
    state.requestRow = {
      id: "request-1",
      assigned_therapist_id: "coach-a",
    };
    state.reads = [];
    state.writes = [];
    state.updateResult = { data: { id: "request-1" }, error: null };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects unauthenticated requests without reading or writing", async () => {
    state.auth = {
      member: null,
      supabase: null,
      error: "NO_TOKEN",
      status: 401,
    };

    const response = await POST(makeRequest({
      anfrageId: "request-1",
      meeting_link_override: "https://meet.example.invalid",
    }));

    expect(response.status).toBe(401);
    expect(state.reads).toHaveLength(0);
    expect(state.writes).toHaveLength(0);
  });

  it("rejects a therapist who does not own the request", async () => {
    state.requestRow.assigned_therapist_id = "coach-b";

    const response = await POST(makeRequest({
      anfrageId: "request-1",
      meeting_link_override: "https://meet.example.invalid",
    }));

    expect(response.status).toBe(403);
    expect(state.writes).toHaveLength(0);
  });

  it("allows the assigned therapist and returns no request data", async () => {
    const response = await POST(makeRequest({
      anfrageId: "request-1",
      meeting_link_override: "  https://meet.example.invalid  ",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].payload).toEqual({
      meeting_link_override: "https://meet.example.invalid",
    });
    expect(state.writes[0].filters).toContainEqual(["assigned_therapist_id", "coach-a"]);
  });

  it("allows an active admin to update a request", async () => {
    state.requestRow.assigned_therapist_id = "coach-b";
    state.auth.member = { id: "admin-1", role: "admin", active: true };

    const response = await POST(makeRequest({
      anfrageId: "request-1",
      meeting_link_override: null,
    }));

    expect(response.status).toBe(200);
    expect(state.writes[0].filters).not.toContainEqual(["assigned_therapist_id", "admin-1"]);
  });

  it("does not expose request data when the assignment changes before update", async () => {
    state.updateResult = { data: null, error: null };

    const response = await POST(makeRequest({
      anfrageId: "request-1",
      meeting_link_override: "https://meet.example.invalid",
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "REQUEST_ASSIGNMENT_CHANGED",
    });
  });
});
