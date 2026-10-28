import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appointmentCareContext,
  beginAppointmentOperation,
  withAppointmentOperation,
} from "../../app/lib/appointmentCare.js";

const state = vi.hoisted(() => ({
  sb: null, version: 1, allowed: true, owner: "coach-a",
  provider: vi.fn(), writes: [], rpcCalls: [], contextError: null,
  member: null,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (...args) => state.sb.from(...args),
    rpc: (...args) => state.sb.rpc(...args),
  }),
}));
vi.mock("googleapis", () => ({ google: { calendar: state.provider } }));
vi.mock("resend", () => ({ Resend: class { emails = { send: state.provider }; } }));
vi.mock("../../app/lib/messaging/conversations.js", () => ({
  ensureOpenConversation: vi.fn(async () => ({ id: null, status: "pending", reply_alias: null })),
}));
vi.mock("../../app/lib/draftRecovery.js", () => ({
  sendDraftRecoveryReminders: async () => ({ sentCount: 0, sentLogs: [] }),
}));
vi.mock("../../app/api/_lib/server.js", () => ({
  getActiveTeamMember: async () => ({
    member: state.member, supabase: state.sb, error: "NO_TOKEN", status: 401,
  }),
  getUserFromBearer: async () => ({ user: { id: "user-a" } }),
  supabaseAdmin: () => state.sb,
  canAccessAssignedRequest: (member, coachId) => member.role === "admin" || member.id === coachId,
  oauthClient: () => { state.provider(); return { setCredentials: vi.fn() }; },
  json: (body, status = 200) => Response.json(body, { status }),
}));

import { POST as add } from "../../app/api/add-session/route.js";
import { POST as batch } from "../../app/api/add-sessions-batch/route.js";
import { POST as book } from "../../app/api/booking/book/route.js";
import { POST as confirm } from "../../app/api/confirm-proposal/route.js";
import { POST as reschedule } from "../../app/api/new-appointment/route.js";
import { GET as appointment } from "../../app/api/client/appointment/route.js";
import { POST as remind } from "../../app/api/reminder/route.js";
import { GET as reminders } from "../../app/api/reminders/send/route.js";
import { POST as createProposals } from "../../app/api/proposals/create/route.js";
import { POST as sendProposals } from "../../app/api/send-proposals/route.js";
import { POST as confirmAppointmentRoute } from "../../app/api/confirm-appointment/route.js";
import { POST as cancel } from "../../app/api/client/appointment/cancel/route.js";
import { POST as rescheduleRequest } from "../../app/api/client/appointment/reschedule-request/route.js";
import { confirmAppointment } from "../../app/lib/handlers/confirmAppointment.js";
import { currentMeetingLinkOverride } from "../../app/lib/meetingLinkScope.js";

function request(body, method = "POST") {
  return new Request("https://example.invalid/api/test?token=synthetic-token", {
    method,
    ...(method === "POST" ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-key");
  vi.clearAllMocks();
  state.version = 1; state.allowed = true; state.owner = "coach-a";
  state.contextError = null; state.writes = []; state.rpcCalls = [];
  state.member = { id: "coach-a", role: "therapist" };
  vi.stubGlobal("fetch", state.provider);
  const row = {
    id: "request-a", assigned_therapist_id: "coach-a", therapist_id: "coach-a",
    email: "synthetic@example.invalid", vorname: "Synthetic", honorar_klient: 100,
    bevorzugte_zeit: new Date(Date.now() + 24 * 3600000).toISOString(),
    date: new Date(Date.now() + 24 * 3600000).toISOString(),
    anfrage_id: "request-a", anfragen: { email: "synthetic@example.invalid" },
  };
  state.sb = {
    rpc: vi.fn(async (name, args) => {
      state.rpcCalls.push({ name, args });
      if (name === "privacy_appointment_context") return {
        data: { allowed: state.allowed, careVersion: state.version, coachId: state.owner },
        error: state.contextError,
      };
      return { data: { allowed: true, careVersion: args.p_expected_version ?? 0, coachId: "coach-a", operationId: args.p_operation_id }, error: null };
    }),
    from(table) {
      const value = table === "team_members" ? {
        id: "coach-a", role: "therapist", active: true,
        name: "Current Coach", profile_calendar_mode: "proposal",
      } : table === "therapist_booking_settings" ? {
        selected_calendar_id: "synthetic-calendar", meeting_link: "https://video.example.invalid/current",
      }
        : table === "appointment_proposals" ? {
          id: "proposal-a", anfrage_id: "request-a", therapist_id: "coach-a",
          date: "2099-01-01T10:00:00Z", google_event_id: "synthetic-event",
        } : row;
      const chain = {
        select: () => chain, eq: () => chain, gte: () => chain,
        lte: () => chain, not: () => chain,
        order: () => chain, limit: () => chain,
        single: async () => ({ data: value, error: null }),
        maybeSingle: async () => ({ data: value, error: null }),
        then: (resolve) => Promise.resolve({ data: [value], error: null }).then(resolve),
        insert(payload) { state.writes.push({ table, payload }); return chain; },
        update(payload) { state.writes.push({ table, payload }); return chain; },
        delete() { state.writes.push({ table }); return chain; },
      };
      return chain;
    },
  };
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("appointment transfer barriers without providers", () => {
  it.each([
    ["single coach session", add, "therapist", {
      anfrageId: "request-a", therapist_id: "coach-a",
      date: "2099-01-01T10:00:00Z", duration: 60, price: 100,
    }],
    ["single admin session", add, "admin", {
      anfrageId: "request-a", therapist_id: "coach-a",
      date: "2099-01-01T10:00:00Z", duration: 60, price: 100,
    }],
    ["coach batch", batch, "therapist", {
      anfrageId: "request-a",
      sessions: [{ date: "2099-01-01T10:00:00Z", duration: 60, price: 100 }],
    }],
    ["admin batch", batch, "admin", {
      anfrageId: "request-a",
      sessions: [{ date: "2099-01-01T10:00:00Z", duration: 60, price: 100 }],
    }],
    ["token-bound follow-up booking", book, "therapist", {
      token: "synthetic-token", start: "2099-01-01T10:00:00Z", durationMin: 60,
    }],
  ])("preserves authorized %s through the server client", async (_name, route, role, body) => {
    state.version = 0;
    state.member = { id: role === "admin" ? "admin-a" : "coach-a", role, active: true };
    const insertEvent = vi.fn(async () => ({ data: { id: "synthetic-new-event" } }));
    const availability = {
      id: "synthetic-availability", summary: "POISE VERFÜGBAR",
      start: { dateTime: "2099-01-01T09:00:00Z" },
      end: { dateTime: "2099-01-01T14:00:00Z" },
    };
    state.provider.mockImplementation(() => ({
      data: { id: "synthetic-mail" },
      events: {
        insert: insertEvent,
        list: vi.fn(async () => ({ data: { items: [availability] } })),
      },
    }));
    const rows = {
      anfragen: {
        id: "request-a", assigned_therapist_id: "coach-a", care_version: 0,
        honorar_klient: 100, vorname: "Synthetic", email: "synthetic@example.invalid",
      },
      team_members: { ...state.member, name: "Synthetic Coach", email: "coach@example.invalid" },
      therapist_booking_settings: {
        booking_enabled: true, selected_calendar_id: "synthetic-calendar",
        time_zone: "Europe/Vienna", meeting_link: "https://video.example.invalid/current",
      },
    };
    state.sb.from = (table) => {
      let payload;
      const result = () => ({
        data: payload ? { id: `synthetic-${table}`, ...payload } : rows[table] || [],
        error: null,
      });
      const chain = {
        select: () => chain, eq: () => chain, lt: () => chain, gt: () => chain,
        gte: () => chain, lte: () => chain, limit: () => chain, order: () => chain,
        single: async () => result(), maybeSingle: async () => result(),
        then: (resolve) => Promise.resolve(result()).then(resolve),
        insert(value) {
          payload = value;
          state.writes.push({ table, operation: "insert", payload: value });
          return chain;
        },
        update(value) {
          payload = value;
          state.writes.push({ table, operation: "update", payload: value });
          return chain;
        },
      };
      return chain;
    };

    const response = await route(request(body));
    expect(await response.json()).not.toHaveProperty("error");
    expect(response.status).toBe(200);
    expect(state.writes).toContainEqual({
      table: "sessions", operation: "insert",
      payload: expect.objectContaining({
        anfrage_id: "request-a", therapist_id: "coach-a", price: 100, duration_min: 60,
      }),
    });
    expect(insertEvent).toHaveBeenCalledOnce();
    expect(state.rpcCalls.some(({ name }) => name === "privacy_begin_appointment_operation")).toBe(true);
    expect(state.rpcCalls.at(-1).name).toBe("privacy_end_appointment_operation");
  });

  it("maps explicit denied context without version metadata to a conflict", async () => {
    state.sb.rpc = vi.fn(async () => ({ data: { allowed: false }, error: null }));
    expect(await appointmentCareContext(state.sb, "request-a", "coach-a")).toEqual({
      error: "APPOINTMENT_ASSIGNMENT_CHANGED", status: 409,
    });
  });
  it.each(["returned", "thrown"])("maps %s SQL care-version conflict to 409", async (mode) => {
    state.sb.rpc = vi.fn(async () => {
      if (mode === "thrown") throw new Error("CARE_VERSION_CONFLICT");
      return { data: null, error: { message: "CARE_VERSION_CONFLICT" } };
    });
    expect(await beginAppointmentOperation(state.sb, "request-a", "coach-a", 3)).toEqual({
      error: "APPOINTMENT_ASSIGNMENT_CHANGED", status: 409,
    });
  });
  it("keeps context database errors unavailable even with a false payload", async () => {
    state.sb.rpc = vi.fn(async () => ({
      data: { allowed: false }, error: { message: "MISSING_SCHEMA" },
    }));
    expect((await appointmentCareContext(state.sb, "request-a", "coach-a")).status).toBe(503);
  });
  it.each([
    ["single session", add, { anfrageId: "request-a", therapist_id: "coach-a", date: "2099-01-01", duration: 60, price: 100 }],
    ["batch", batch, { anfrageId: "request-a", sessions: [{ date: "2099-01-01", duration: 60, price: 100 }] }],
    ["booking link", book, { token: "synthetic-token", start: "2099-01-01" }],
    ["proposal link", confirm, { token: "synthetic-token", proposalId: "proposal-a" }],
    ["reschedule", reschedule, { requestId: "request-a" }],
    ["client view", appointment, null, "GET"],
    ["create proposals", createProposals, { requestId: "request-a", therapist_id: "coach-a", proposals: [{ date: "2099-01-01T10:00" }] }],
    ["send proposals", sendProposals, { requestId: "request-a", proposals: ["2099-01-01T10:00Z"] }],
    ["confirm appointment", confirmAppointmentRoute, { requestId: "request-a" }],
    ["client cancellation", cancel, { token: "synthetic-token" }],
    ["client reschedule", rescheduleRequest, { token: "synthetic-token" }],
  ])("rejects transferred %s before mutations/providers", async (_name, route, body, method) => {
    const response = await route(request(body, method));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/APPOINTMENT_(REBIND_REQUIRED|TRANSFER_PAUSED)/);
    expect(state.writes).toEqual([]);
    expect(state.provider).not.toHaveBeenCalled();
  });

  it.each([["session reminders", remind, "POST"], ["initial reminders", reminders, "GET"]])(
    "skips transferred %s", async (_name, route, method) => {
      const response = await route(request({}, method));
      expect(response.status).toBe(200);
      expect(state.provider).not.toHaveBeenCalled();
      expect(state.writes).toEqual([]);
    }
  );

  it("preserves version zero context with current ownership", async () => {
    state.version = 0;
    expect(await appointmentCareContext(state.sb, "request-a", "coach-a")).toEqual({
      careVersion: 0, coachId: "coach-a",
    });
  });
    it.each([
      ["anonymous", null, 401],
      ["inactive/no authenticated member", null, 401],
      ["wrong role", { id: "coach-a", role: "viewer" }, 403],
      ["another coach", { id: "coach-b", role: "therapist" }, 403],
    ])("rejects %s proposal creation without provider actions", async (_name, member, status) => {
      state.member = member;
      const response = await createProposals(request({
        requestId: "request-a", therapist_id: "coach-a",
        proposals: [{ date: "2099-01-01T10:00" }],
      }));
      expect(response.status).toBe(status);
      expect(state.writes).toEqual([]);
      expect(state.provider).not.toHaveBeenCalled();
    });
    it("denies stale shared-handler confirmation before mutations/providers", async () => {
      await expect(confirmAppointment({
        supabase: state.sb, requestId: "request-a", expectedAssignedTherapistId: "coach-a",
        client: "synthetic@example.invalid", vorname: "Synthetic",
      })).rejects.toThrow("APPOINTMENT_TRANSFER_PAUSED");
      expect(state.writes).toEqual([]);
      expect(state.provider).not.toHaveBeenCalled();
    });
  it("creates version-bound new-coach proposals only inside a persistent claim", async () => {
    state.version = 3;
    const insertEvent = vi.fn(async () => {
      expect(state.rpcCalls.some(({ name }) => name === "privacy_begin_appointment_operation")).toBe(true);
      return { data: { id: "synthetic-proposal-event" } };
    });
    state.provider.mockReturnValue({ events: { insert: insertEvent, delete: vi.fn() } });
    const send = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("fetch", send);
    state.sb.from = (table) => {
      let write = false;
      const resolve = () => ({
        error: null,
        data: table === "appointment_proposals"
          ? (write ? { id: "proposal-new" } : [])
          : table === "therapist_booking_settings" ? { selected_calendar_id: "synthetic-calendar" }
          : table === "team_members" ? { name: "Current Coach" }
          : {
            id: "request-a", assigned_therapist_id: "coach-a",
            email: "synthetic@example.invalid", booking_token: "synthetic-token",
            wunschtherapeut: "Historical Coach",
          },
      });
      const q = {
        select: () => q, eq: () => q,
        single: async () => resolve(), maybeSingle: async () => resolve(),
        insert(payload) { write = true; state.writes.push({ table, payload }); return q; },
        update(payload) { write = true; state.writes.push({ table, payload }); return q; },
        delete() { write = true; return q; },
        then: (fn) => Promise.resolve(resolve()).then(fn),
      };
      return q;
    };
    const response = await createProposals(request({
      requestId: "request-a", therapist_id: "coach-a", expectedCareVersion: 3,
      proposals: [{ date: "2099-01-01T10:00" }],
    }));
    expect(response.status).toBe(200);
    expect(insertEvent).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
    expect(JSON.parse(send.mock.calls[0][1].body).html).not.toContain("Historical Coach");
    expect(state.rpcCalls.map(({ name }) => name)).toEqual([
      "privacy_appointment_context", "privacy_begin_appointment_operation", "privacy_end_appointment_operation",
    ]);
  });
  it.each([
    ["send proposals", sendProposals, { requestId: "request-a", proposals: ["2099-01-01T10:00Z"] }],
    ["confirm appointment", confirmAppointmentRoute, { requestId: "request-a" }],
    ["cancel appointment", cancel, { token: "synthetic-token" }],
    ["request reschedule", rescheduleRequest, { token: "synthetic-token" }],
  ])("preserves version-bound neutral %s for the new coach", async (_name, route, body) => {
    state.version = 3;
    const send = vi.fn(async () => {
      expect(state.rpcCalls.some(({ name }) => name === "privacy_begin_appointment_operation")).toBe(true);
      return { ok: true };
    });
    vi.stubGlobal("fetch", send);
    const response = await route(request({ ...body, expectedCareVersion: 3 }));
    expect(response.status).toBe(200);
    expect(state.writes.length).toBeGreaterThan(0);
    expect(state.rpcCalls.at(-1).name).toBe("privacy_end_appointment_operation");
  });
  it.each([
    ["legacy", {}, "https://video.example.invalid/override"],
    ["same episode", { care_version: 3, meeting_link_care_version: 3 }, "https://video.example.invalid/override"],
    ["old coach", { care_version: 3, meeting_link_care_version: 0 }, ""],
    ["A→B→A", { care_version: 2, meeting_link_care_version: 0 }, ""],
    ["malformed", { care_version: "bad", meeting_link_care_version: "bad" }, ""],
  ])("scopes %s meeting-link overrides without deleting stored values", (_name, versions, expected) => {
    const row = { ...versions, meeting_link_override: "https://video.example.invalid/override" };
    expect(currentMeetingLinkOverride(row)).toBe(expected);
    expect(row.meeting_link_override).toBe("https://video.example.invalid/override");
  });
  it("permits explicitly version-bound current staff appointments after transfer", async () => {
    state.version = "3";
    expect(await appointmentCareContext(state.sb, "request-a", "coach-a", {
      expectedVersion: "3",
    })).toEqual({ careVersion: "3", coachId: "coach-a" });
    expect(state.rpcCalls[0].args.p_expected_care_version).toBe("3");
    const response = await withAppointmentOperation(async (operation) => {
      expect((await operation.begin(state.sb, "request-a", "coach-a", "3")).operationId).toBeTruthy();
      return Response.json({ ok: true });
    });
    expect(response.status).toBe(200);
    expect(state.rpcCalls[1].args.p_expected_version).toBe("3");
  });
  it("rejects A→B→A stale staff versions and unsigned transferred links", async () => {
    state.version = 2;
    expect((await appointmentCareContext(state.sb, "request-a", "coach-a", {
      expectedVersion: 0,
    })).error).toBe("APPOINTMENT_ASSIGNMENT_CHANGED");
    expect((await appointmentCareContext(state.sb, "request-a", "coach-a", {
      link: true,
    })).error).toBe("APPOINTMENT_REBIND_REQUIRED");
  });
  it("rejects stale ownership even at version zero", async () => {
    state.version = 0; state.owner = "coach-b";
    expect((await appointmentCareContext(state.sb, "request-a", "coach-a")).error)
      .toBe("APPOINTMENT_ASSIGNMENT_CHANGED");
  });
  it.each([null, -1, 0.5, "invalid", Number.MAX_SAFE_INTEGER + 1])(
    "fails closed for malformed version %s", async (version) => {
      state.version = version;
      expect((await appointmentCareContext(state.sb, "request-a", "coach-a")).status).toBe(503);
    }
  );
  it("fails closed for unavailable RPC", async () => {
    state.contextError = { code: "MISSING_RPC" };
    expect((await book(request({ token: "synthetic-token", start: "2099-01-01" }))).status).toBe(503);
    expect(state.provider).not.toHaveBeenCalled();
  });
  it("does not accept a mismatched proposal owner even before the first transfer", async () => {
    state.version = 0;
    state.owner = "coach-b";
    const response = await confirm(request({ token: "synthetic-token", proposalId: "proposal-a" }));
    expect(response.status).toBe(409);
    expect(state.writes).toEqual([]);
    expect(state.provider).not.toHaveBeenCalled();
  });
  it("denies a transfer winning between context and persistent claim before providers", async () => {
    state.version = 0;
    const original = state.sb.rpc;
    state.sb.rpc = vi.fn(async (name, args) => name === "privacy_begin_appointment_operation"
      ? { data: { allowed: false }, error: null } : original(name, args));
    const response = await book(request({ token: "synthetic-token", start: "2099-01-01" }));
    expect(response.status).toBe(409);
    expect(state.writes).toEqual([]);
    expect(state.provider).not.toHaveBeenCalled();
  });
  it("fails closed when claim completion is unavailable", async () => {
    const original = state.sb.rpc;
    state.sb.rpc = vi.fn(async (name, args) => name === "privacy_end_appointment_operation"
      ? { data: null, error: { code: "UNAVAILABLE" } } : original(name, args));
    const response = await withAppointmentOperation(async (operation) => {
      await operation.begin(state.sb, "request-a", "coach-a");
      return Response.json({ ok: true });
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "APPOINTMENT_OPERATION_PENDING" });
  });

  it("releases a persistent operation only after successful completion", async () => {
    const response = await withAppointmentOperation(async (operation) => {
      expect((await operation.begin(state.sb, "request-a", "coach-a")).operationId).toBeTruthy();
      expect(state.rpcCalls.map(({ name }) => name)).toEqual(["privacy_begin_appointment_operation"]);
      return Response.json({ ok: true });
    });
    expect(response.status).toBe(200);
    expect(state.rpcCalls.map(({ name }) => name)).toEqual([
      "privacy_begin_appointment_operation", "privacy_end_appointment_operation",
    ]);
  });
  it.each(["error", "unknown"])("leaves %s operations pending without TTL", async (mode) => {
    const response = await withAppointmentOperation(async (operation) => {
      await operation.begin(state.sb, "request-a", "coach-a");
      if (mode === "unknown") operation.markUnknown();
      return Response.json({}, { status: mode === "error" ? 502 : 200 });
    });
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(state.rpcCalls.map(({ name }) => name)).toEqual(["privacy_begin_appointment_operation"]);
  });
});
