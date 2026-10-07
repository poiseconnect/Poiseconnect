import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  current: null,
  client: {
    from: (table) => mocks.current.from(table),
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mocks.client,
}));

import { POST } from "../../app/api/create-request-draft/route.js";

const REQUEST_ID = "request-test-id";
const COACH_ID = "coach-test-id";

function createSupabase(initialRequest) {
  const state = { ...initialRequest };
  const updates = [];

  const context = {
    state,
    updates,
    beforeUpdate: null,
    from(table) {
      if (table !== "anfragen") throw new Error(`Unexpected table: ${table}`);

      let operation = "select";
      let payload = null;
      let selectedFields = "";
      const filters = [];

      const chain = {
        select(fields) {
          selectedFields = fields;
          return chain;
        },
        update(value) {
          operation = "update";
          payload = value;
          updates.push({ payload, filters });
          return chain;
        },
        insert() {
          throw new Error("Unexpected insert");
        },
        eq(field, value) {
          filters.push([field, value]);
          return chain;
        },
        maybeSingle: async () => {
          const idFilter = filters.find(([field]) => field === "id");
          if (!idFilter || idFilter[1] !== state.id) {
            return { data: null, error: null };
          }

          if (operation === "select") {
            const statusOnly = selectedFields === "status";
            return {
              data: statusOnly ? { status: state.status } : { ...state },
              error: null,
            };
          }

          if (operation === "update" && context.beforeUpdate) {
            context.beforeUpdate();
            context.beforeUpdate = null;
          }

          const statusFilter = filters.find(([field]) => field === "status");
          if (statusFilter && statusFilter[1] !== state.status) {
            return { data: null, error: null };
          }

          Object.assign(state, payload);
          return {
            data: {
              id: state.id,
              booking_token: state.booking_token,
              assigned_therapist_id: state.assigned_therapist_id,
            },
            error: null,
          };
        },
      };

      return chain;
    },
  };

  return context;
}

function request(body) {
  return new Request("https://app.example.invalid/api/create-request-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function draftBody(overrides = {}) {
  return {
    anfrageId: REQUEST_ID,
    assigned_therapist_id: COACH_ID,
    wunschtherapeut: "Testcoach",
    vorname: "Test",
    email: "test@example.invalid",
    ...overrides,
  };
}

describe("POST /api/create-request-draft", () => {
  beforeEach(() => {
    mocks.current = createSupabase({
      id: REQUEST_ID,
      status: "draft",
      match_state: "draft",
      draft_last_activity_at: "2026-10-07T10:00:00.000Z",
      booking_token: "synthetic-token",
      assigned_therapist_id: COACH_ID,
      anliegen: "existing draft details",
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("updates a request that is still a draft", async () => {
    const response = await POST(request(draftBody({ vorname: "Updated" })));

    expect(response.status).toBe(200);
    expect(mocks.current.state).toMatchObject({
      status: "draft",
      match_state: "draft",
      vorname: "Updated",
    });
    expect(mocks.current.updates).toHaveLength(1);
    expect(mocks.current.updates[0].filters).toContainEqual(["status", "draft"]);
  });

  it("rejects a finalized request without changing any fields", async () => {
    Object.assign(mocks.current.state, {
      status: "neu",
      match_state: "pending",
      draft_last_activity_at: "2026-10-07T12:18:00.000Z",
    });
    const before = { ...mocks.current.state };

    const response = await POST(request(draftBody({
      vorname: "Must not overwrite",
      assigned_therapist_id: "different-coach",
    })));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "REQUEST_ALREADY_FINALIZED",
    });
    expect(mocks.current.state).toEqual(before);
    expect(mocks.current.updates).toHaveLength(0);
    expect(console.warn).toHaveBeenCalledWith("DRAFT UPDATE CONFLICT", {
      route: "/api/create-request-draft",
      requestId: REQUEST_ID,
      currentStatus: "neu",
      code: "REQUEST_ALREADY_FINALIZED",
    });
  });

  it.each(["termin_bestaetigt", "active"])(
    "rejects a request with status %s",
    async (status) => {
      mocks.current.state.status = status;
      const before = { ...mocks.current.state };

      const response = await POST(request(draftBody()));

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: "REQUEST_ALREADY_FINALIZED",
      });
      expect(mocks.current.state).toEqual(before);
      expect(mocks.current.updates).toHaveLength(0);
    }
  );

  it("does not overwrite a request finalized after the initial status check", async () => {
    const before = { ...mocks.current.state };
    mocks.current.beforeUpdate = () => {
      mocks.current.state.status = "neu";
      mocks.current.state.match_state = "pending";
    };

    const response = await POST(request(draftBody({
      vorname: "Must not overwrite",
    })));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "REQUEST_ALREADY_FINALIZED",
    });
    expect(mocks.current.state).toEqual({
      ...before,
      status: "neu",
      match_state: "pending",
    });
    expect(mocks.current.updates).toHaveLength(1);
  });
});
