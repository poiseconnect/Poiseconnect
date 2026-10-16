import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HEALTH_DATA_CONSENT_VERSION,
  hashHealthDataConsentToken,
} from "../../app/lib/healthDataConsent.js";

const mocks = vi.hoisted(() => ({
  current: null,
  consent: null,
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
const CONSENT_TOKEN = "a".repeat(64);

function createSupabase(initialRequest) {
  const state = { ...initialRequest };
  const updates = [];
  const deletions = [];
  const consent = mocks.consent;

  const context = {
    state,
    updates,
    deletions,
    beforeUpdate: null,
    deleted: false,
    from(table) {
      if (table === "anfrage_health_data_consents") {
        let operation = "select";
        let payload;
        const filters = [];
        const chain = {
          select() {
            return chain;
          },
          update(value) {
            operation = "update";
            payload = value;
            return chain;
          },
          eq(field, value) {
            filters.push([field, value]);
            return chain;
          },
          is(field, value) {
            filters.push([field, value]);
            return chain;
          },
          maybeSingle: async () => {
            const matches = filters.every(([field, value]) => consent[field] === value);
            if (!matches) return { data: null, error: null };
            if (operation === "update") {
              if (consent.linkFails && payload.request_id) {
                return { data: null, error: null };
              }
              Object.assign(consent, payload);
            }
            return { data: { ...consent }, error: null };
          },
        };
        return chain;
      }
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
        insert(value) {
          operation = "insert";
          payload = value;
          return chain;
        },
        delete() {
          operation = "delete";
          deletions.push(filters);
          return chain;
        },
        eq(field, value) {
          filters.push([field, value]);
          return chain;
        },
        maybeSingle: async () => {
          if (operation === "delete") {
            context.deleted = filters.some(
              ([field, value]) => field === "id" && value === state.id
            );
            return { data: null, error: null };
          }
          if (operation === "insert") {
            Object.assign(state, payload, { id: "new-draft" });
            return { data: { ...state }, error: null };
          }
          const idFilter = filters.find(([field]) => field === "id");
          if (!idFilter || idFilter[1] !== state.id) {
            return { data: null, error: null };
          }
          const tokenFilter = filters.find(([field]) => field === "booking_token");
          if (tokenFilter && tokenFilter[1] !== state.booking_token) {
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
          if (tokenFilter && tokenFilter[1] !== state.booking_token) {
            return { data: null, error: null };
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

      chain.single = chain.maybeSingle;
      chain.then = (resolve, reject) =>
        Promise.resolve(chain.maybeSingle()).then(resolve, reject);
      return chain;
    },
  };

  return context;
}

function request(body) {
  mocks.consent.request_id = body.anfrageId || null;
  return new Request("https://app.example.invalid/api/create-request-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function draftBody(overrides = {}) {
  return {
    anfrageId: REQUEST_ID,
    booking_token: "synthetic-token",
    assigned_therapist_id: COACH_ID,
    wunschtherapeut: "Testcoach",
    intakeConsentToken: CONSENT_TOKEN,
    vorname: "Test",
    email: "test@example.invalid",
    ...overrides,
  };
}

describe("POST /api/create-request-draft", () => {
  beforeEach(() => {
    mocks.consent = {
      id: "consent-test-id",
      request_id: REQUEST_ID,
      token_hash: hashHealthDataConsentToken(CONSENT_TOKEN),
      text_version: HEALTH_DATA_CONSENT_VERSION,
      granted_at: "2026-10-16T10:00:00.000Z",
      revoked_at: null,
    };
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
    expect(mocks.current.updates[0].filters).toContainEqual(["booking_token", "synthetic-token"]);
  });

  it("preserves public draft creation without any existing credential", async () => {
    const response = await POST(request(draftBody({ anfrageId: null, booking_token: null })));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe("new-draft");
    expect(data.booking_token).toMatch(/^[a-f0-9-]{36}$/);
    expect(mocks.current.state.status).toBe("draft");
    expect(mocks.consent.request_id).toBe("new-draft");
  });

  it("rolls back a newly created draft if its consent cannot be linked", async () => {
    mocks.consent.request_id = null;
    mocks.consent.linkFails = true;

    const response = await POST(
      request(draftBody({ anfrageId: null, booking_token: null }))
    );

    expect(response.status).toBe(503);
    expect(mocks.current.deleted).toBe(true);
    expect(mocks.current.deletions).toHaveLength(1);
  });

  it("rejects draft writes without an active server-side health-data consent", async () => {
    const before = { ...mocks.current.state };
    const response = await POST(request(draftBody({ intakeConsentToken: null })));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "HEALTH_DATA_CONSENT_REQUIRED",
    });
    expect(mocks.current.state).toEqual(before);
    expect(mocks.current.updates).toHaveLength(0);
  });

  it.each([null, "", "wrong-token"])("cannot replace the recipient without the current token (%s)", async (booking_token) => {
    const before = { ...mocks.current.state };
    const response = await POST(request(draftBody({ booking_token, email: "other@example.invalid" })));
    expect(response.status).toBe(booking_token ? 404 : 401);
    expect(mocks.current.updates).toHaveLength(0);
    expect(mocks.current.state).toEqual(before);
    expect(await response.text()).not.toContain("synthetic-token");
  });

  it("does not update after the booking token is replaced concurrently", async () => {
    mocks.current.beforeUpdate = () => { mocks.current.state.booking_token = "new-token"; };
    const response = await POST(request(draftBody({ email: "other@example.invalid" })));
    expect(response.status).toBe(404);
    expect(mocks.current.state.email).not.toBe("other@example.invalid");
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
