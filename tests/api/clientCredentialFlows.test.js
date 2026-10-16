import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({ reads: [], writes: [], deletedEvent: vi.fn() }));
vi.mock("googleapis", () => ({ google: { calendar: () => ({ events: { delete: mocks.deletedEvent } }) } }));
vi.mock("../../app/api/_lib/server.js", () => ({ oauthClient: () => ({ setCredentials: vi.fn() }) }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table) => {
      const filters = [];
      let operation = "read";
      let payload;
      const resolve = () => {
        if (operation !== "read") {
          mocks.writes.push({ table, operation, payload, filters });
          return { data: null, error: null };
        }
        mocks.reads.push({ table, filters });
        if (table === "anfragen") {
          if (!filters.some(([key, value]) => key === "booking_token" && value === "synthetic-token")) {
            return { data: null, error: null };
          }
          return { data: { id: "request-1", assigned_therapist_id: "coach-1", email: "client@example.invalid", status: "termin_bestaetigt" }, error: null };
        }
        if (table === "team_members") return { data: { id: "coach-1", name: "Testcoach", email: "coach@example.invalid", profile_calendar_mode: "proposal" }, error: null };
        if (table === "therapist_booking_settings") return { data: { selected_calendar_id: "synthetic-calendar" }, error: null };
        if (table === "blocked_slots") return { data: [{ id: "client-block", start_at: "2099-10-20T10:00:00Z", end_at: "2099-10-20T10:30:00Z", google_event_id: "client-event" }], error: null };
        if (table === "appointment_proposals") return { data: [{ id: "proposal-1", date: "2099-10-20T10:00:00Z" }], error: null };
        throw new Error(`Unexpected table ${table}`);
      };
      const chain = {
        select: () => chain,
        eq: (key, value) => { filters.push([key, value]); return chain; },
        gte: () => chain, order: () => chain, limit: () => chain,
        update: (value) => { operation = "update"; payload = value; return chain; },
        delete: () => { operation = "delete"; return chain; },
        single: async () => resolve(),
        then: (fn) => Promise.resolve(resolve()).then(fn),
      };
      return chain;
    },
  }),
}));
import { GET as appointment } from "../../app/api/client/appointment/route.js";
import { POST as cancel } from "../../app/api/client/appointment/cancel/route.js";
import { POST as reschedule } from "../../app/api/client/appointment/reschedule-request/route.js";
import { POST as proposals } from "../../app/api/proposals/list/route.js";

function request(token, method = "POST") {
  return new Request(`https://app.example.invalid/api/test${method === "GET" && token ? `?token=${token}` : ""}`, {
    method,
    ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) } : {}),
  });
}

describe("existing tokenized client flows remain intact", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.reads = []; mocks.writes = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    mocks.deletedEvent.mockResolvedValue({});
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("loads appointment and proposals with the current token", async () => {
    expect((await appointment(request("synthetic-token", "GET"))).status).toBe(200);
    const response = await proposals(request("synthetic-token"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "proposal-1", date: "2099-10-20T10:00:00Z" }]);
  });
  it.each([
    ["appointment", (token) => appointment(request(token, "GET"))],
    ["proposals", (token) => proposals(request(token))],
    ["cancel", (token) => cancel(request(token))],
    ["reschedule", (token) => reschedule(request(token))],
  ])("preserves missing/invalid-token rejection in %s", async (_name, call) => {
    expect((await call(null)).status).toBe(400);
    expect((await call("wrong-token")).status).toBe(404);
    expect(mocks.writes).toHaveLength(0);
    expect(mocks.deletedEvent).not.toHaveBeenCalled();
  });
  it("reschedule requests leave existing appointments and calendar events unchanged", async () => {
    expect((await reschedule(request("synthetic-token"))).status).toBe(200);
    expect(mocks.writes).toEqual([expect.objectContaining({ table: "anfragen", operation: "update", payload: { match_state: "reschedule_requested" } })]);
    expect(mocks.deletedEvent).not.toHaveBeenCalled();
  });
  it("cancels only the concrete client event/block, never availability or sessions", async () => {
    expect((await cancel(request("synthetic-token"))).status).toBe(200);
    expect(mocks.deletedEvent).toHaveBeenCalledExactlyOnceWith({ calendarId: "synthetic-calendar", eventId: "client-event" });
    expect(mocks.writes).toContainEqual({ table: "blocked_slots", operation: "delete", payload: undefined, filters: [["id", "client-block"]] });
    expect(mocks.writes.some(({ table }) => table === "sessions")).toBe(false);
  });
  it("covers every historical producer and keeps their links on the secured/recovery consumers", () => {
    const source = (path) => readFileSync(path, "utf8");
    expect(source("app/api/send-proposals/route.js")).toContain("token=${encodeURIComponent(request.booking_token)}");
    expect(source("app/api/send-proposals/route.js")).not.toContain("confirm-proposal?id=");
    expect(source("app/api/new-appointment/route.js")).toContain("to: client");
    expect(source("app/api/new-appointment/route.js")).toContain("encodeURIComponent(requestRow.booking_token)");
    expect(source("app/api/therapist-response/route.js")).not.toContain("mypoise.de/?resume=");
    for (const path of ["app/api/admin-forward/route.js", "app/api/forward-request/route.js"]) {
      expect(source(path)).toContain("&token=");
    }
    for (const path of ["app/api/proposals/create/route.js", "app/api/cron/proposal-reminders/route.js"]) {
      expect(source(path)).toContain("/confirm-proposal?token=");
    }
    expect(source("app/lib/draftRecovery.js")).toContain("&token=${token}");
  });
});
