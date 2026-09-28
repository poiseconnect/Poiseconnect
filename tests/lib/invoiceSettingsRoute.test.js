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

import { POST } from "../../app/api/invoice-settings/route.js";
import { POST as saveSettings } from "../../app/api/accounting-settings/route.js";
import {
  getInvoiceSettingsTargetId,
  isInvoiceSettingsReady,
  shouldShowInvoiceSettingsPrompt,
} from "../../app/lib/invoiceSettingsUi.js";

function createQuery(result, calls = []) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column, value) => {
      calls.push([column, value]);
      return query;
    }),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
  };
  return query;
}

function createSupabase({ member, target, settings, errors = {} }) {
  const calls = [];
  let teamMemberQueryCount = 0;
  const sb = {
    from: vi.fn((table) => {
      if (table === "team_members") {
        teamMemberQueryCount += 1;
        const result = teamMemberQueryCount === 1
          ? { data: member, error: errors.member || null }
          : { data: target, error: errors.target || null };
        return createQuery(result, calls);
      }
      if (table === "therapist_invoice_settings") {
        return createQuery(
          { data: settings, error: errors.settings || null },
          calls
        );
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
  return { sb, calls };
}

function createSaveSupabase({ member, target, currentSettings }) {
  const calls = [];
  const writes = [];
  let teamMemberQueryCount = 0;
  const sb = {
    from: vi.fn((table) => {
      if (table === "team_members") {
        teamMemberQueryCount += 1;
        const result = teamMemberQueryCount === 1 ? member : target;
        return createQuery({ data: result, error: null }, calls);
      }
      if (table === "therapist_invoice_settings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: currentSettings, error: null }),
            }),
          }),
          upsert: async (payload, options) => {
            writes.push({ payload, options });
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
  return { sb, writes };
}

function request(therapistId, token = "valid-token") {
  return new Request("https://app.example.invalid/api/invoice-settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ therapist_id: therapistId }),
  });
}

describe("invoice settings load route authorization", () => {
  beforeEach(() => {
    getUserFromBearer.mockReset();
    supabaseAdmin.mockReset();
  });

  it("returns 401 for unauthenticated requests", async () => {
    getUserFromBearer.mockResolvedValue({ user: null, error: "NO_TOKEN" });

    const response = await POST(request("coach-a", ""));

    expect(response.status).toBe(401);
  });

  it("allows a coach to load their own settings", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-coach-a" } });
    const { sb } = createSupabase({
      member: { id: "coach-a", role: "therapist", active: true },
      target: { id: "coach-a" },
      settings: { therapist_id: "coach-a", company_name: "Coach A" },
    });
    supabaseAdmin.mockReturnValue(sb);

    const response = await POST(request("coach-a"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      settings: { therapist_id: "coach-a", company_name: "Coach A" },
    });
  });

  it("returns 403 when a coach requests another coach's settings", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-coach-a" } });
    const { sb } = createSupabase({
      member: { id: "coach-a", role: "therapist", active: true },
      target: { id: "coach-b" },
      settings: { therapist_id: "coach-b" },
    });
    supabaseAdmin.mockReturnValue(sb);

    const response = await POST(request("coach-b"));

    expect(response.status).toBe(403);
    expect(sb.from).toHaveBeenCalledTimes(1);
  });

  it("allows an active admin to load another coach's settings", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-admin" } });
    const { sb } = createSupabase({
      member: { id: "admin-1", role: "admin", active: true },
      target: { id: "coach-b" },
      settings: { therapist_id: "coach-b", company_name: "Coach B" },
    });
    supabaseAdmin.mockReturnValue(sb);

    const response = await POST(request("coach-b"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      settings: { therapist_id: "coach-b", company_name: "Coach B" },
    });
  });

  it("returns an empty settings object when the coach has no row yet", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-admin" } });
    const { sb } = createSupabase({
      member: { id: "admin-1", role: "admin", active: true },
      target: { id: "coach-new" },
      settings: null,
    });
    supabaseAdmin.mockReturnValue(sb);

    const response = await POST(request("coach-new"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ settings: {} });
  });

  it("allows a coach to save their own settings with the unique upsert target", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-coach-a" } });
    const { sb, writes } = createSaveSupabase({
      member: { id: "coach-a", role: "therapist", active: true },
      target: { id: "coach-a" },
      currentSettings: null,
    });
    supabaseAdmin.mockReturnValue(sb);

    const response = await saveSettings(
      new Request("https://app.example.invalid/api/accounting-settings", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ therapist_id: "coach-a", company_name: "Coach A" }),
      })
    );

    expect(response.status).toBe(200);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      payload: { therapist_id: "coach-a", company_name: "Coach A" },
      options: { onConflict: "therapist_id" },
    });
  });

  it("allows an admin to create settings for a coach who has no row", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-admin" } });
    const { sb, writes } = createSaveSupabase({
      member: { id: "admin-1", role: "admin", active: true },
      target: { id: "coach-new" },
      currentSettings: null,
    });
    supabaseAdmin.mockReturnValue(sb);

    const response = await saveSettings(
      new Request("https://app.example.invalid/api/accounting-settings", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ therapist_id: "coach-new", company_name: "New Coach" }),
      })
    );

    expect(response.status).toBe(200);
    expect(writes[0].payload.therapist_id).toBe("coach-new");
    expect(writes[0].options).toEqual({ onConflict: "therapist_id" });
  });

  it("allows an admin to update the existing settings row for a selected coach", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-admin" } });
    const existing = {
      therapist_id: "coach-b",
      company_name: "Old Name",
      vat_number: "DE123456789",
      business_country_code: "DE",
      uid_confirmed_at: "2026-09-01T00:00:00.000Z",
      uid_confirmed_by: "admin-old",
    };
    const { sb, writes } = createSaveSupabase({
      member: { id: "admin-1", role: "admin", active: true },
      target: { id: "coach-b" },
      currentSettings: existing,
    });
    supabaseAdmin.mockReturnValue(sb);

    const response = await saveSettings(
      new Request("https://app.example.invalid/api/accounting-settings", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          therapist_id: "coach-b",
          company_name: "Updated Name",
          vat_number: "DE987654321",
          business_country_code: "DE",
          uid_confirmed_at: "client-forged",
          uid_confirmed_by: "client-forged",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(writes).toHaveLength(1);
    expect(writes[0].payload).toMatchObject({
      therapist_id: "coach-b",
      company_name: "Updated Name",
      vat_number: "DE987654321",
      uid_confirmed_at: null,
      uid_confirmed_by: null,
    });
  });

  it("rejects a coach trying to save another coach's settings", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-coach-a" } });
    const { sb, writes } = createSaveSupabase({
      member: { id: "coach-a", role: "therapist", active: true },
      target: { id: "coach-b" },
      currentSettings: null,
    });
    supabaseAdmin.mockReturnValue(sb);

    const response = await saveSettings(
      new Request("https://app.example.invalid/api/accounting-settings", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ therapist_id: "coach-b", company_name: "Injected" }),
      })
    );

    expect(response.status).toBe(403);
    expect(writes).toHaveLength(0);
  });
});

describe("invoice settings form selection state", () => {
  it("uses the selected coach for admin and self team member for coaches", () => {
    expect(
      getInvoiceSettingsTargetId({
        isAdmin: true,
        selectedCoachId: "coach-b",
        coachId: "admin-1",
      })
    ).toBe("coach-b");
    expect(
      getInvoiceSettingsTargetId({
        isAdmin: false,
        selectedCoachId: "alle",
        coachId: "coach-a",
      })
    ).toBe("coach-a");
  });

  it("hides admin profile data for all coaches and until the selected coach loads", () => {
    const targetId = getInvoiceSettingsTargetId({
      isAdmin: true,
      selectedCoachId: "alle",
      coachId: null,
    });
    expect(shouldShowInvoiceSettingsPrompt({ isAdmin: true, targetId })).toBe(true);
    expect(
      isInvoiceSettingsReady({
        targetId: "coach-b",
        loadedForId: "coach-a",
        loading: false,
      })
    ).toBe(false);
    expect(
      isInvoiceSettingsReady({
        targetId: "coach-b",
        loadedForId: "coach-b",
        loading: false,
      })
    ).toBe(true);
  });
});