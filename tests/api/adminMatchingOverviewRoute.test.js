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

import { GET } from "../../app/api/admin/matching-overview/route.js";

function request() {
  return new Request("https://app.example.invalid/api/admin/matching-overview", {
    headers: { Authorization: "Bearer test-token" },
  });
}

function createSupabase({ member, members = [] }) {
  const tablesQueried = [];

  const sb = {
    tablesQueried,
    from: vi.fn((table) => {
      tablesQueried.push(table);

      if (table !== "team_members") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const query = {
        select: vi.fn((columns) => {
          query.selectedColumns = columns;
          return query;
        }),
        eq: vi.fn((column, value) => {
          query.filters = [...(query.filters || []), [column, value]];
          return query;
        }),
        single: vi.fn(async () => ({ data: member, error: null })),
        then: (resolve) => resolve({ data: members, error: null }),
      };
      return query;
    }),
  };

  return sb;
}

describe("admin matching overview route", () => {
  beforeEach(() => {
    getUserFromBearer.mockReset();
    supabaseAdmin.mockReset();
  });

  it("rejects requests without a valid user", async () => {
    getUserFromBearer.mockResolvedValue({ user: null, error: "NO_TOKEN" });

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(supabaseAdmin).not.toHaveBeenCalled();
  });

  it("rejects non-admin members before loading the overview", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "coach-user" } });
    const supabase = createSupabase({
      member: { id: "coach-a", role: "therapist", active: true },
    });
    supabaseAdmin.mockReturnValue(supabase);

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it("rejects inactive admins", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "admin-user" } });
    const supabase = createSupabase({
      member: { id: "admin-a", role: "admin", active: false },
    });
    supabaseAdmin.mockReturnValue(supabase);

    const response = await GET(request());

    expect(response.status).toBe(403);
  });

  it("returns therapist members with scores and availability for admins", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "admin-user" } });
    const members = [
      {
        id: "coach-a",
        name: "Coach A",
        profile_name: "Coach A Profil",
        role: "therapist",
        active: true,
        available_for_intake: true,
        matching_scores: { stress: 4 },
      },
    ];
    const supabase = createSupabase({
      member: { id: "admin-a", role: "admin", active: true },
      members,
    });
    supabaseAdmin.mockReturnValue(supabase);

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, members });
    // Rein lesend: ausschließlich team_members wird gelesen
    expect(supabase.tablesQueried).toEqual(["team_members", "team_members"]);
  });

  it("only exposes a GET handler (read-only route)", async () => {
    const routeModule = await import(
      "../../app/api/admin/matching-overview/route.js"
    );

    expect(typeof routeModule.GET).toBe("function");
    expect(routeModule.POST).toBeUndefined();
    expect(routeModule.PUT).toBeUndefined();
    expect(routeModule.PATCH).toBeUndefined();
    expect(routeModule.DELETE).toBeUndefined();
  });
});
