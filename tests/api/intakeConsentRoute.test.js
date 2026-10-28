import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashHealthDataConsentToken } from "../../app/lib/healthDataConsent.js";

const mocks = vi.hoisted(() => ({
  consents: [],
  requests: [{ id: "request-1", booking_token: "booking-token" }],
  rpc: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: (...args) => mocks.rpc(...args),
    from(table) {
      let operation = "select";
      let payload;
      let selected = "";
      const filters = [];

      const matches = (row) =>
        filters.every(([kind, field, value]) => {
          if (kind === "eq") return row[field] === value;
          if (kind === "neq") return row[field] !== value;
          if (kind === "is") return row[field] === value;
          return true;
        });

      const resolve = () => {
        if (table === "anfragen") {
          const request = mocks.requests.find(matches);
          return { data: request ? { id: request.id } : null, error: null };
        }

        if (table !== "anfrage_health_data_consents") {
          throw new Error(`Unexpected table ${table}`);
        }

        if (operation === "insert") {
          const row = {
            id: `consent-${mocks.consents.length + 1}`,
            granted_at: "2026-10-17T10:00:00.000Z",
            revoked_at: null,
            ...payload,
          };
          mocks.consents.push(row);
          return { data: row, error: null };
        }

        if (operation === "update") {
          const rows = mocks.consents.filter(matches);
          rows.forEach((row) => Object.assign(row, payload));
          return { data: rows[0] || null, error: null };
        }

        const row = mocks.consents.find(matches);
        if (!row) return { data: null, error: null };
        const fields = selected.split(",").map((field) => field.trim());
        return {
          data: Object.fromEntries(fields.map((field) => [field, row[field]])),
          error: null,
        };
      };

      const chain = {
        select(fields) {
          selected = fields;
          return chain;
        },
        insert(value) {
          operation = "insert";
          payload = value;
          return chain;
        },
        update(value) {
          operation = "update";
          payload = value;
          return chain;
        },
        eq(field, value) {
          filters.push(["eq", field, value]);
          return chain;
        },
        neq(field, value) {
          filters.push(["neq", field, value]);
          return chain;
        },
        is(field, value) {
          filters.push(["is", field, value]);
          return chain;
        },
        maybeSingle: async () => resolve(),
        single: async () => resolve(),
        then: (resolvePromise, rejectPromise) =>
          Promise.resolve(resolve()).then(resolvePromise, rejectPromise),
      };
      return chain;
    },
  }),
}));

import { POST } from "../../app/api/intake-consent/route.js";

function request(body) {
  return new Request("https://app.example.invalid/api/intake-consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/intake-consent", () => {
  beforeEach(() => {
    mocks.consents = [];
    mocks.requests = [{ id: "request-1", booking_token: "booking-token" }];
    mocks.rpc.mockReset();
    mocks.rpc.mockImplementation(async (name, args) => {
      if (name === "privacy_authorize_recipient") return { data: true, error: null };
      const request = mocks.requests.find((row) =>
        row.id === args.p_request_id && row.booking_token === args.p_booking_token);
      if (name === "privacy_grant_intake_consent") {
        if (args.p_request_id && !request) {
          return { data: null, error: { message: "REQUEST_NOT_FOUND" } };
        }
        const row = { id: `consent-${mocks.consents.length + 1}`,
          request_id: args.p_request_id, token_hash: args.p_token_hash,
          text_version: "2026-10-16-v1", granted_at: "2026-10-27T10:00:00Z",
          revoked_at: null };
        mocks.consents.push(row);
        return { data: row.id, error: null };
      }
      if (name === "privacy_revoke_intake_consent") {
        const consent = mocks.consents.find((row) => row.token_hash === args.p_token_hash);
        if (!consent || (consent.request_id && !request)) return { data: false, error: null };
        consent.revoked_at = "2026-10-27T11:00:00Z";
        return { data: true, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("records a versioned grant without storing or returning client-entered fields", async () => {
    const response = await POST(request({ action: "grant" }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.version).toBe("2026-10-16-v1");
    expect(result.consentToken).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.consents).toHaveLength(1);
    expect(mocks.consents[0]).toMatchObject({
      request_id: null,
      token_hash: hashHealthDataConsentToken(result.consentToken),
      text_version: result.version,
      granted_at: expect.any(String),
      revoked_at: null,
    });
    expect(JSON.stringify(mocks.consents[0])).not.toContain(result.consentToken);
  });

  it("requires the existing request booking token before recording a grant", async () => {
    const response = await POST(
      request({
        action: "grant",
        requestId: "request-1",
        booking_token: "wrong-token",
      })
    );

    expect(response.status).toBe(404);
    expect(mocks.consents).toHaveLength(0);
  });

  it("records a grant for an existing request and revokes it without deleting its audit row", async () => {
    const grantResponse = await POST(
      request({
        action: "grant",
        requestId: "request-1",
        booking_token: "booking-token",
      })
    );
    const { consentToken } = await grantResponse.json();

    const revokeResponse = await POST(
      request({
        action: "revoke",
        requestId: "request-1",
        booking_token: "booking-token",
        consentToken,
      })
    );

    expect(revokeResponse.status).toBe(200);
    expect(mocks.consents).toHaveLength(1);
    expect(mocks.consents[0].request_id).toBe("request-1");
    expect(mocks.consents[0].revoked_at).toEqual(expect.any(String));
  });

  it("does not revoke an existing request consent without its booking token", async () => {
    const grantResponse = await POST(
      request({
        action: "grant",
        requestId: "request-1",
        booking_token: "booking-token",
      })
    );
    const { consentToken } = await grantResponse.json();

    const revokeResponse = await POST(
      request({ action: "revoke", consentToken })
    );

    expect(revokeResponse.status).toBe(404);
    expect(mocks.consents[0].revoked_at).toBeNull();
  });

  it("requires explicit versioned recipient acceptance before invoking scope RPC", async () => {
    const response = await POST(request({ action: "authorize-recipient",
      coachId: "coach-1", consentToken: "a".repeat(64) }));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("passes recipient identity, proof hash and expected care version without widening the original proof", async () => {
    const response = await POST(request({ action: "authorize-recipient",
      requestId: "request-1", booking_token: "booking-token", coachId: "coach-1",
      consentToken: "a".repeat(64), accepted: true, expectedCareVersion: 3,
      noticeVersion: "2026-10-28-recipient-v1" }));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("privacy_authorize_recipient", {
      p_request_id: "request-1", p_booking_token: "booking-token",
      p_consent_hash: hashHealthDataConsentToken("a".repeat(64)),
      p_coach_id: "coach-1", p_expected_version: 3,
      p_notice_version: "2026-10-28-recipient-v1",
    });
    expect(mocks.consents).toHaveLength(0);
  });

  it("fails closed when the recipient-scope RPC is missing", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    const response = await POST(request({ action: "authorize-recipient",
      coachId: "coach-1", consentToken: "a".repeat(64), accepted: true,
      noticeVersion: "2026-10-28-recipient-v1" }));
    expect(response.status).toBe(503);
  });
});
