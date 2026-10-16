import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HEALTH_DATA_CONSENT_VERSION,
  hashHealthDataConsentToken,
} from "../../app/lib/healthDataConsent.js";

const mocks = vi.hoisted(() => ({
  filters: [], writes: [], validToken: "synthetic-current-token", race: false,
  rollbacks: [],
  consent: null,
  ensure: vi.fn(), send: vi.fn(),
}));
vi.mock("../../app/lib/teamData.js", () => ({ teamData: [{ id: "coach-1", name: "Testcoach" }] }));
vi.mock("../../app/lib/messaging/conversations.js", () => ({ ensureOpenConversation: mocks.ensure }));
vi.mock("../../app/lib/loadPublishedCoachingCosts.js", () => ({ loadPublishedCoachingCosts: async () => ({ html: "<p>Testkosten</p>" }) }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.send }; } }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table) => {
      let operation = "select";
      let payload;
      const filters = [];
      const resolve = () => {
        if (table === "anfrage_health_data_consents") {
          const matches = filters.every(([key, value]) => {
            if (key === "revoked_at") return mocks.consent.revoked_at === value;
            return mocks.consent[key] === value;
          });
          if (!matches) return { data: null, error: null };
          if (operation === "update") {
            if (mocks.consent.linkFails && payload.request_id) {
              return { data: null, error: null };
            }
            Object.assign(mocks.consent, payload);
            return { data: { id: mocks.consent.id }, error: null };
          }
          return { data: { ...mocks.consent }, error: null };
        }
        mocks.filters.push({ operation, filters: [...filters] });
        if (operation === "delete") {
          mocks.rollbacks.push([...filters]);
          return { data: null, error: null };
        }
        if (operation === "insert") {
          mocks.writes.push(payload);
          return { data: { id: "new-request" }, error: null };
        }
        const valid = filters.some(([key, value]) => key === "booking_token" && value === mocks.validToken);
        if (!valid || (operation === "update" && mocks.race)) return { data: null, error: null };
        if (operation === "update") mocks.writes.push(payload);
        return { data: { id: "existing-request" }, error: null };
      };
      const chain = {
        select: () => chain,
        eq: (key, value) => { filters.push([key, value]); return chain; },
        is: (key, value) => { filters.push([key, value]); return chain; },
        update: (value) => { operation = "update"; payload = value; return chain; },
        insert: (value) => { operation = "insert"; payload = value; return chain; },
        delete: () => { operation = "delete"; return chain; },
        maybeSingle: async () => resolve(), single: async () => resolve(),
        then: (fn, reject) => Promise.resolve(resolve()).then(fn, reject),
      };
      return chain;
    },
  }),
}));
import { POST } from "../../app/api/form-submit/route.js";
const CONSENT_TOKEN = "c".repeat(64);
const body = { anfrageId: "existing-request", booking_token: "synthetic-current-token", intakeConsentToken: CONSENT_TOKEN, email: "new@example.invalid", wunschtherapeut: "Testcoach", assigned_therapist_id: "coach-1" };
const request = (value) => {
  mocks.consent.request_id = value.anfrageId || null;
  return new Request("https://app.example.invalid/api/form-submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
};

describe("public request finalization access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.filters = []; mocks.writes = []; mocks.race = false; mocks.rollbacks = [];
    mocks.consent = {
      id: "consent-test-id",
      request_id: "existing-request",
      token_hash: hashHealthDataConsentToken(CONSENT_TOKEN),
      text_version: HEALTH_DATA_CONSENT_VERSION,
      granted_at: "2026-10-16T10:00:00.000Z",
      revoked_at: null,
    };
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-key");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.send.mockResolvedValue({ data: { id: "mail" }, error: null });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it.each([null, "", "wrong-token"])("cannot replace a recipient or finalize without the current token (%s)", async (booking_token) => {
    const response = await POST(request({ ...body, booking_token }));
    expect(response.status).toBe(booking_token ? 404 : 401);
    expect(mocks.writes).toHaveLength(0);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.ensure).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("synthetic-current-token");
  });
  it("allows an authorized update and filters the write by the current credential", async () => {
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    expect(mocks.writes).toHaveLength(1);
    expect(mocks.writes[0]).toMatchObject({ email: body.email, status: "neu" });
    expect(mocks.filters.find(({ operation }) => operation === "update").filters).toContainEqual(["booking_token", body.booking_token]);
  });
  it("rejects sensitive form content without a recorded active consent", async () => {
    const response = await POST(
      request({ ...body, intakeConsentToken: null, anliegen: "synthetic sensitive content" })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "HEALTH_DATA_CONSENT_REQUIRED",
    });
    expect(mocks.writes).toHaveLength(0);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.ensure).not.toHaveBeenCalled();
  });
  it("rejects a credential rotated between lookup and update without mail side effects", async () => {
    mocks.race = true;
    const response = await POST(request(body));
    expect(response.status).toBe(404);
    expect(mocks.writes).toHaveLength(0);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.ensure).not.toHaveBeenCalled();
  });
  it("preserves new public intake without requiring an existing token", async () => {
    const response = await POST(request({ ...body, anfrageId: null, booking_token: null }));
    expect(response.status).toBe(200);
    expect(mocks.writes).toHaveLength(1);
    expect(mocks.writes[0].booking_token).toMatch(/^[a-f0-9-]{36}$/);
  });
  it("rolls back a newly created request if its consent cannot be linked", async () => {
    mocks.consent.linkFails = true;

    const response = await POST(
      request({ ...body, anfrageId: null, booking_token: null })
    );

    expect(response.status).toBe(503);
    expect(mocks.rollbacks).toHaveLength(1);
    expect(mocks.rollbacks[0]).toContainEqual(["id", "new-request"]);
    expect(mocks.ensure).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("applies the same token guard to the historical rid alias", async () => {
    const response = await POST(request({ ...body, anfrageId: null, rid: "existing-request", booking_token: null }));
    expect(response.status).toBe(401);
    expect(mocks.writes).toHaveLength(0);
  });
});
