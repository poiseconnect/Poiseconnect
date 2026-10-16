import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashHealthDataConsentToken } from "../../app/lib/healthDataConsent.js";

const mocks = vi.hoisted(() => ({
  consents: [],
  requests: [{ id: "request-1", booking_token: "booking-token" }],
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
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
});
