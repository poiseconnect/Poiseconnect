import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserFromBearer = vi.hoisted(() => vi.fn());
const supabaseAdmin = vi.hoisted(() => vi.fn());

vi.mock("../../app/api/_lib/server.js", () => ({
  getUserFromBearer,
  supabaseAdmin,
  json: (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
}));

import { GET } from "../../app/api/admin/billing-sessions/route.js";

function request() {
  return new Request("https://app.example.invalid/api/admin/billing-sessions", {
    headers: { Authorization: "Bearer valid-token" },
  });
}

function createSupabase({ member, sessions = [], settings = [] }) {
  return {
    from: vi.fn((table) => {
      if (table === "team_members") {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          single: vi.fn(async () => ({ data: member, error: null })),
        };
        return query;
      }
      if (table === "sessions") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(async () => ({ data: sessions, error: null })),
          })),
        };
      }
      if (table === "therapist_invoice_settings") {
        return {
          select: vi.fn(async () => ({ data: settings, error: null })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("admin billing sessions route", () => {
  beforeEach(() => {
    getUserFromBearer.mockReset();
    supabaseAdmin.mockReset();
  });

  it("returns billing sessions and all coach invoice settings in one response", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "admin-user" } });
    supabaseAdmin.mockReturnValue(createSupabase({
      member: { id: "admin-member", role: "admin", active: true },
      sessions: [{ id: "session-a", therapist_id: "coach-a" }],
      settings: [
        { therapist_id: "coach-a", default_vat_rate: 19 },
        { therapist_id: "coach-b", default_vat_rate: 20 },
      ],
    }));

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ id: "session-a", therapist_id: "coach-a" }],
      coachInvoiceSettings: [
        { therapist_id: "coach-a", default_vat_rate: 19 },
        { therapist_id: "coach-b", default_vat_rate: 20 },
      ],
    });
  });

  it("rejects non-admin members before loading billing data", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "coach-user" } });
    const supabase = createSupabase({
      member: { id: "coach-a", role: "therapist", active: true },
    });
    supabaseAdmin.mockReturnValue(supabase);

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});