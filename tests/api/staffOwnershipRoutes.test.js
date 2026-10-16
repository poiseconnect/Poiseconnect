import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: null,
  requestRow: null,
  supabase: null,
  sessionRow: null,
  reads: [],
  writes: [],
}));

vi.mock("../../app/api/_lib/server.js", () => ({
  getActiveTeamMember: async () => state.auth,
  getUserFromBearer: async () => ({ user: { id: "auth-coach-a" }, error: null }),
  supabaseAdmin: () => state.supabase,
  canAccessAssignedRequest: (member, assignedId) =>
    member?.role === "admin" || String(member?.id) === String(assignedId),
  json: (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  oauthClient: () => ({ setCredentials: vi.fn() }),
}));

vi.mock("googleapis", () => ({
  google: { calendar: () => ({ events: { delete: vi.fn() } }) },
}));

import { POST as newAppointment } from "../../app/api/new-appointment/route.js";
import { POST as sendProposals } from "../../app/api/send-proposals/route.js";
import { POST as updateClient } from "../../app/api/update-client/route.js";
import { POST as deleteForever } from "../../app/api/requests/delete-forever/route.js";
import { POST as deleteSession } from "../../app/api/delete-session/route.js";
import { GET as therapistResponse } from "../../app/api/therapist-response/route.js";
import { POST as updateStatus } from "../../app/api/requests/update-status/route.js";

function makeRequest(body, method = "POST") {
  return new Request("https://app.example.invalid/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function createSupabase() {
  return {
    from(table) {
      const filters = [];
      let operation = "read";
      const query = {
        select() {
          return query;
        },
        eq(column, value) {
          filters.push([column, value]);
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        maybeSingle: async () => {
          state.reads.push({ table, filters });
          return { data: tableData(table), error: null };
        },
        single: async () => {
          state.reads.push({ table, filters });
          return { data: tableData(table), error: null };
        },
        update(payload) {
          operation = "update";
          state.writes.push({ table, type: "update", payload });
          return query;
        },
        insert(payload) {
          state.writes.push({ table, type: "insert", payload });
          return query;
        },
        delete() {
          operation = "delete";
          state.writes.push({ table, type: "delete" });
          return query;
        },
        or(value) {
          filters.push(["or", value]);
          return query;
        },
        then(resolve) {
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
}

function tableData(table) {
  if (table === "team_members") {
    return { id: "coach-a", role: "therapist", active: true };
  }
  if (table === "sessions") return state.sessionRow;
  return state.requestRow;
}

describe("staff ownership boundaries", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    state.reads = [];
    state.writes = [];
    state.requestRow = {
      id: "request-1",
      assigned_therapist_id: "coach-b",
      email: "client@example.invalid",
      booking_token: "synthetic-token",
      vorname: "Test",
      wunschtherapeut: "Testcoach",
    };
    state.sessionRow = { id: "session-1", therapist_id: "auth-coach-a" };
    state.supabase = createSupabase();
    state.auth = {
      user: { id: "auth-coach-a" },
      member: { id: "coach-a", role: "therapist", active: true },
      supabase: state.supabase,
      error: null,
      status: 200,
    };
  });

  it.each([
    ["rescheduling another coach's request", newAppointment, { requestId: "request-1" }],
    ["sending proposals for another coach's request", sendProposals, {
      requestId: "request-1",
      proposals: ["2099-10-20T10:00:00.000Z"],
    }],
    ["editing another coach's client", updateClient, {
      anfrageId: "request-1",
      email: "changed@example.invalid",
    }],
  ])("denies %s without writing", async (_name, route, body) => {
    const response = await route(makeRequest(body));
    expect(response.status).toBe(403);
    expect(state.writes).toHaveLength(0);
  });

  it("keeps permanent request deletion admin-only", async () => {
    const response = await deleteForever(makeRequest({ requestId: "request-1" }));
    expect(response.status).toBe(403);
    expect(state.writes).toHaveLength(0);
  });

  it("allows an active coach to update the status of their assigned request", async () => {
    state.requestRow.assigned_therapist_id = "coach-a";
    const response = await updateStatus(
      makeRequest({ requestId: "request-1", status: "admin_pruefen" })
    );

    expect(response.status).toBe(200);
    expect(state.writes).toContainEqual({
      table: "anfragen",
      type: "update",
      payload: { status: "admin_pruefen", first_response_at: expect.any(String) },
    });
  });

  it("allows an active coach to edit their assigned client's contact details", async () => {
    state.requestRow.assigned_therapist_id = "coach-a";
    const response = await updateClient(
      makeRequest({
        anfrageId: "request-1",
        vorname: "Synthetic",
        nachname: "Client",
        email: "updated@example.invalid",
      })
    );

    expect(response.status).toBe(200);
    expect(state.writes).toContainEqual({
      table: "anfragen",
      type: "update",
      payload: expect.objectContaining({ email: "updated@example.invalid" }),
    });
  });

  it("allows an active coach to send proposals for their assigned request", async () => {
    state.requestRow.assigned_therapist_id = "coach-a";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const response = await sendProposals(
      makeRequest({
        requestId: "request-1",
        proposals: ["2099-10-20T10:00:00.000Z"],
      })
    );

    expect(response.status).toBe(200);
    expect(state.writes).toContainEqual({
      table: "appointment_proposals",
      type: "insert",
      payload: [
        {
          request_id: "request-1",
          therapist_id: "coach-a",
          proposed_at: "2099-10-20T10:00:00.000Z",
        },
      ],
    });
  });

  it("allows an active coach to send a reschedule link for their assigned request", async () => {
    state.requestRow.assigned_therapist_id = "coach-a";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const response = await newAppointment(
      makeRequest({ requestId: "request-1", oldSlot: null })
    );

    expect(response.status).toBe(200);
    expect(state.writes).toContainEqual({
      table: "anfragen",
      type: "update",
      payload: expect.objectContaining({
        status: "termin_neu",
        assigned_therapist_id: "coach-a",
      }),
    });
  });

  it("allows an admin to permanently delete a request", async () => {
    state.auth.member = { id: "admin-1", role: "admin", active: true };
    const response = await deleteForever(makeRequest({ requestId: "request-1" }));

    expect(response.status).toBe(200);
    expect(state.writes).toContainEqual({
      table: "anfragen",
      type: "delete",
    });
  });

  it("preserves deletion of a therapist's historical session stored by auth user ID", async () => {
    const response = await deleteSession(makeRequest({ sessionId: "session-1" }));
    expect(response.status).toBe(200);
    expect(state.writes).toContainEqual({
      table: "sessions",
      type: "delete",
    });
  });

  it("makes legacy therapist response links side-effect free", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.invalid";
    const response = await therapistResponse(
      new Request("https://app.example.invalid/api/therapist-response?action=confirm&client=client%40example.invalid")
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example.invalid/dashboard");
    expect(state.reads).toHaveLength(0);
    expect(state.writes).toHaveLength(0);
  });
});
