import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const queryConfig = vi.hoisted(() => ({
  selectFields: "",
  eqId: null,
  eqToken: null,
  mockData: null,
  mockError: null,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: vi.fn((table) => {
      if (table !== "anfragen") throw new Error(`Unexpected table ${table}`);
      return {
        select: vi.fn((fields) => {
          queryConfig.selectFields = fields;
          const chain = {
            eq: vi.fn((col, val) => {
              if (col === "id") queryConfig.eqId = val;
              if (col === "booking_token") queryConfig.eqToken = val;
              return chain;
            }),
            single: vi.fn(async () => {
              if (queryConfig.mockError) {
                return { data: null, error: queryConfig.mockError };
              }
              if (!queryConfig.mockData) {
                return { data: null, error: { code: "PGRST116" } };
              }
              if (queryConfig.eqId && queryConfig.mockData.id !== queryConfig.eqId) {
                return { data: null, error: { code: "PGRST116" } };
              }
              if (
                queryConfig.eqToken &&
                queryConfig.mockData.booking_token !== queryConfig.eqToken
              ) {
                return { data: null, error: { code: "PGRST116" } };
              }
              return { data: queryConfig.mockData, error: null };
            }),
          };
          return chain;
        }),
      };
    }),
  }),
}));

import { GET, PUBLIC_REQUEST_SELECT_FIELDS } from "../../app/api/public-request/route.js";

function getRequestUrl(id, token) {
  let url = `https://app.example.invalid/api/public-request`;
  const params = [];
  if (id) params.push(`id=${encodeURIComponent(id)}`);
  if (token) params.push(`token=${encodeURIComponent(token)}`);
  if (params.length) url += `?${params.join("&")}`;
  return new Request(url, { method: "GET" });
}

describe("public request route security fix", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    queryConfig.selectFields = "";
    queryConfig.eqId = null;
    queryConfig.eqToken = null;
    queryConfig.mockError = null;
    queryConfig.mockData = {
      id: "anfrage-123",
      booking_token: "token-uuid-123",
      vorname: "Maria",
      nachname: "Muster",
      email: "maria@example.invalid",
      telefon: "0664123456",
      strasse_hausnr: "Hauptstraße 1",
      plz_ort: "1010 Wien",
      geburtsdatum: "1990-01-01",
      beschaeftigungsgrad: "berufstaetig",
      themen: ["stress"],
      anliegen: "Mehr Ruhe finden",
      leidensdruck: "mittel",
      verlauf: "seit 3 Monaten",
      diagnose: "Nein",
      ziel: "Gelassenheit",
      coaching_typ: "einzel",
      wunschtherapeut: "Anna Coach",
      assigned_therapist_id: "coach-uuid-1",
      admin_therapeuten: ["coach-uuid-1"],
      structured_time_preference: ["abend"],
      bevorzugte_zeit: "2026-10-01T10:00:00.000Z",
    };
  });

  it("returns 200 with whitelisted fields when valid id and matching token are supplied", async () => {
    const res = await GET(getRequestUrl("anfrage-123", "token-uuid-123"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.request).toMatchObject({
      id: "anfrage-123",
      booking_token: "token-uuid-123",
      vorname: "Maria",
      email: "maria@example.invalid",
    });
    expect(queryConfig.selectFields).toBe(PUBLIC_REQUEST_SELECT_FIELDS);
    expect(queryConfig.selectFields).not.toContain("*");
    expect(queryConfig.eqId).toBe("anfrage-123");
    expect(queryConfig.eqToken).toBe("token-uuid-123");
  });

  it("returns 404 when an invalid or mismatched token is supplied", async () => {
    const res = await GET(getRequestUrl("anfrage-123", "wrong-token-999"));

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("REQUEST_NOT_FOUND");
    expect(json.request).toBeUndefined();
  });

  it("supports legacy requests without token for backward compatibility using whitelisted fields only", async () => {
    const res = await GET(getRequestUrl("anfrage-123"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.request).toMatchObject({
      id: "anfrage-123",
      vorname: "Maria",
    });
    expect(queryConfig.selectFields).toBe(PUBLIC_REQUEST_SELECT_FIELDS);
    expect(queryConfig.eqId).toBe("anfrage-123");
    expect(queryConfig.eqToken).toBeNull();
  });

  it("does not select internal/admin/billing/messaging fields", () => {
    const fields = PUBLIC_REQUEST_SELECT_FIELDS.split(", ").map((f) => f.trim());

    expect(fields).not.toContain("status");
    expect(fields).not.toContain("match_state");
    expect(fields).not.toContain("created_at");
    expect(fields).not.toContain("meeting_link_override");
    expect(fields).not.toContain("honorar_klient");
    expect(fields).not.toContain("invoice_with_vat");
    expect(fields).not.toContain("check_suizid");
    expect(fields).not.toContain("reminder_24h_sent");
    expect(fields).not.toContain("reminder_2h_sent");
  });

  it("passes token in page-client when present in searchParams", () => {
    const clientCode = readFileSync("app/page-client.jsx", "utf8");

    expect(clientCode).toContain("tokenFromUrl");
    expect(clientCode).toContain("&token=");
    expect(clientCode).toContain("public-request?id=");
  });

  it("includes token parameter in link generators admin-forward and forward-request", () => {
    const adminForwardCode = readFileSync("app/api/admin-forward/route.js", "utf8");
    const forwardRequestCode = readFileSync("app/api/forward-request/route.js", "utf8");

    expect(adminForwardCode).toContain("booking_token");
    expect(adminForwardCode).toContain("&token=");
    expect(forwardRequestCode).toContain("booking_token");
    expect(forwardRequestCode).toContain("&token=");
  });
});
