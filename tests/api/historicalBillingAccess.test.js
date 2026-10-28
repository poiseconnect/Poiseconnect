import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null, rows: {}, reads: [], writes: [], sends: vi.fn(), failure: null,
  rpcCalls: [], rpcError: null, rpcResult: undefined, beforeRpc: null,
}));

vi.mock("../../app/api/_lib/server.js", () => ({
  getUserFromBearer: async () => ({ user: state.user, error: "NO_TOKEN" }),
  supabaseAdmin: () => database(),
  getActiveTeamMember: async () => ({
    user: state.user,
    member: state.rows.team_members.find((row) => row.user_id === state.user?.id),
    supabase: database(), error: "NO_ACCESS", status: state.user ? 403 : 401,
  }),
  json: (body, status = 200) => Response.json(body, { status }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => database(),
}));
vi.mock("resend", () => ({
  Resend: class {
    constructor() { this.emails = { send: state.sends }; }
  },
}));

import { GET as load } from "../../app/api/invoices/load/route.js";
import { GET as list } from "../../app/api/invoices/list/route.js";
import { POST as save } from "../../app/api/invoices/save/route.js";
import { POST as send } from "../../app/api/invoices/send/route.js";
import { GET as therapistSessions } from "../../app/api/therapist/billing-sessions/route.js";
import { GET as adminSessions } from "../../app/api/admin/billing-sessions/route.js";
import { POST as deleteSession } from "../../app/api/delete-session/route.js";
import { billingOwnerIds, invoiceRecipientMatches } from "../../app/api/_lib/billingAccess.js";

function database() {
  return {
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    async rpc(name, args) {
      state.rpcCalls.push({ name, args });
      if (state.beforeRpc) state.beforeRpc();
      if (state.rpcError) return { data: null, error: state.rpcError };
      if (state.rpcResult !== undefined) return { data: state.rpcResult, error: null };
      // Synthetic RPC contract only; actual request-lock correctness is covered
      // by the separate PostgreSQL implementation, not by this in-memory model.
      const actor = state.rows.team_members.find((m) => m.user_id === args.p_actor_id);
      if (!actor?.active || !["therapist", "admin"].includes(actor.role)) {
        return { data: null, error: { message: "NO_ACCESS" } };
      }
      const session = state.rows.sessions.find((s) => s.id === args.p_session_id);
      const assignment = state.rows.anfragen.find((r) =>
        r.id === (args.p_request_id || session?.anfrage_id));
      if (name === "privacy_save_client_invoice" &&
          String(assignment?.care_version) !== String(args.p_expected_version)) {
        return { data: null, error: { message: "CARE_VERSION_CONFLICT" } };
      }
      if (actor.role !== "admin" &&
          ![actor.id, actor.user_id].includes(assignment?.assigned_therapist_id)) {
        return { data: null, error: { message: "NO_ACCESS" } };
      }
      if (name === "privacy_delete_care_session") {
        state.writes.push({ table: "sessions", operation: "delete", payload: undefined });
        state.rows.sessions = state.rows.sessions.filter((s) => s.id !== args.p_session_id);
        return { data: { success: true }, error: null };
      }
      if (name === "privacy_save_client_invoice") {
        if (args.p_invoice_id) {
          const invoice = state.rows.invoices.find((row) => row.id === args.p_invoice_id);
          Object.assign(invoice, args.p_payload);
          state.writes.push({ table: "invoices", operation: "update", payload: args.p_payload });
          return { data: structuredClone(invoice), error: null };
        }
        const invoice = { id: "created-invoice", ...args.p_payload };
        state.rows.invoices.push(invoice);
        state.writes.push({ table: "invoices", operation: "insert", payload: args.p_payload });
        return { data: structuredClone(invoice), error: null };
      }
      throw new Error("Unexpected synthetic RPC");
    },
    from(table) {
      let columns = "*", operation = "read", payload;
      const filters = [];
      let sort, cap;
      const query = {
        select(value = "*") { columns = value; return query; },
        eq(key, value) { filters.push((row) => row[key] === value); return query; },
        in(key, values) { filters.push((row) => values.includes(row[key])); return query; },
        gte(key, value) { filters.push((row) => row[key] >= value); return query; },
        lte(key, value) { filters.push((row) => row[key] <= value); return query; },
        order(key, { ascending }) { sort = { key, ascending }; return query; },
        limit(value) { cap = value; return query; },
        update(value) { operation = "update"; payload = value; return query; },
        insert(value) { operation = "insert"; payload = value; return query; },
        delete() { operation = "delete"; return query; },
        single() { return execute(true); },
        maybeSingle() { return execute(true); },
        then(resolve, reject) { return execute(false).then(resolve, reject); },
      };
      async function execute(single) {
        if (state.failure === table) return { data: null, error: { code: "SYNTHETIC" } };
        let rows = (state.rows[table] || []).filter((row) => filters.every((f) => f(row)));
        if (operation !== "read") {
          throw new Error("Billing mutations must use the atomic service-role RPC");
        }
        state.reads.push({ table, columns });
        if (sort) rows = [...rows].sort((a, b) =>
          String(a[sort.key]).localeCompare(String(b[sort.key])) * (sort.ascending ? 1 : -1));
        if (cap) rows = rows.slice(0, cap);
        const projected = rows.map((row) => project(row, columns, table));
        return { data: single ? projected[0] || null : projected, error: null };
      }
      return query;
    },
  };
}

function project(row, columns, table) {
  if (columns === "*") return structuredClone(row);
  const keys = columns.replace(/\([^)]*\)/g, "").split(",").map((key) => key.trim());
  const result = Object.fromEntries(keys.filter((key) => key in row).map((key) => [key, row[key]]));
  if (table === "sessions" && columns.includes("anfragen (")) {
    const request = state.rows.anfragen.find((r) => r.id === row.anfrage_id);
    result.anfragen = request ? project(request, columns.match(/anfragen \(([^)]*)\)/)[1]) : null;
  }
  if (table === "sessions" && columns.includes("team_members (")) {
    result.team_members = { id: row.therapist_id, name: "Synthetic Coach" };
  }
  return structuredClone(result);
}

function request(path = "", body) {
  return new Request(`https://billing.example.invalid/api/test${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { authorization: "Bearer synthetic", "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function as(id) { state.user = { id: `auth-${id}` }; }
function invoicePayload(overrides = {}) {
  return {
    anfrage_id: "case", client_email: "billing@example.invalid",
    line_items: [{ session_id: "b-session", description: "Synthetic service", total: 80 }],
    total_gross: 80, ...overrides,
  };
}

beforeEach(() => {
  state.reads = []; state.writes = []; state.failure = null;
  state.rpcCalls = []; state.rpcError = null; state.rpcResult = undefined; state.beforeRpc = null;
  state.sends.mockReset().mockResolvedValue({ data: { id: "synthetic-mail" } });
  state.rows = {
    team_members: ["a", "b", "admin", "other"].map((id) => ({
      id, user_id: `auth-${id}`, role: id === "admin" ? "admin" : id === "other" ? "support" : "therapist",
      active: true, name: `Synthetic ${id}`, email: `${id}@example.invalid`,
    })),
    anfragen: [{
      id: "case", assigned_therapist_id: "b", care_version: 3, vorname: "Current", nachname: "Identity",
      email: "current@example.invalid", strasse_hausnr: "Current address",
      status: "active", honorar_klient: 120, invoice_with_vat: false,
      anliegen: "HEALTH_SENTINEL", booking_token: "TOKEN_SENTINEL",
    }],
    sessions: [
      { id: "a-session", therapist_id: "a", anfrage_id: "case", date: "2020-01-02", duration_min: 50, price: 60, notes: "HEALTH_SENTINEL" },
      { id: "a-legacy", therapist_id: "auth-a", anfrage_id: "case", date: "2020-01-03", duration_min: 50, price: 60 },
      { id: "a-future", therapist_id: "a", anfrage_id: "case", date: "2099-01-01", duration_min: 50, price: 60 },
      { id: "b-session", therapist_id: "b", anfrage_id: "case", date: "2020-01-04", duration_min: 50, price: 80 },
    ],
    invoices: [{
      id: "invoice-a", anfrage_id: "case", therapist_id: "auth-a", invoice_number: "HIST-1",
      invoice_date: "2020-01-04", client_name: "Historical Identity",
      client_email: "billing@example.invalid", client_street: "Historical address",
      line_items: [{ session_id: "a-session", date: "2020-01-02", description: "Synthetic service", total: 60 }],
      total_gross: 72, total_net: 60, vat_amount: 12, vat_rate: 20,
      status: "sent", updated_at: "2020-01-04", created_at: "2020-01-04",
    }, {
      id: "invoice-b", anfrage_id: "case", therapist_id: "b", updated_at: "2020-01-03",
      client_email: "current@example.invalid", line_items: [], total_gross: 80,
    }],
    therapist_invoice_settings: ["a", "b"].map((id) => ({
      therapist_id: id, company_name: `Synthetic ${id}`, default_vat_rate: 20,
    })),
  };
  as("a");
});

describe("historical billing ownership after A → B", () => {
  it("loads only A's own history and stored invoice identity, without live case fields", async () => {
    const before = structuredClone(state.rows);
    const response = await load(request("?id=case&invoiceId=invoice-a"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.invoice).toEqual(before.invoices[0]);
    expect(body.historicalBillingOnly).toBe(true);
    expect(body.anfrage).toEqual({ id: "case", invoice_with_vat: true });
    expect(body.sessions.map((row) => row.id)).toEqual(["a-session", "a-legacy"]);
    expect(body.settings.therapist_id).toBe("a");
    expect(JSON.stringify(body)).not.toMatch(/HEALTH_SENTINEL|TOKEN_SENTINEL|Current|2099/);
    expect(state.rows).toEqual(before);
    expect(state.writes).toEqual([]);
    expect(state.reads.filter((r) => r.table === "anfragen").map((r) => r.columns))
      .toEqual(["id, assigned_therapist_id"]);
  });

  it("supports historical invoice-ID-only entry and legacy-owner invoice lists", async () => {
    const loaded = await load(request("?invoiceId=invoice-a"));
    expect(loaded.status).toBe(200);
    const response = await list(request("?therapist_id=auth-a"));
    expect((await response.json()).data.map((row) => row.id)).toEqual(["invoice-a"]);
  });

  it("allows explicit admin historical access through the verified legacy owner mapping", async () => {
    as("admin");
    const body = await (await load(request("?invoiceId=invoice-a"))).json();
    expect(body.invoice.therapist_id).toBe("auth-a");
    expect(body.settings.therapist_id).toBe("a");
    expect(body.historicalBillingOnly).toBe(true);
    expect(body.sessions.every((row) => ["a", "auth-a"].includes(row.therapist_id))).toBe(true);
    const response = await list(request("?therapist_id=auth-a"));
    expect((await response.json()).data.map((row) => row.id)).toEqual(["invoice-a"]);
  });

  it("binds the admin billing-row entry to its selected historical coach", async () => {
    as("admin");
    const body = await (await load(request("?id=case&therapistId=a"))).json();
    expect(body.invoice.id).toBe("invoice-a");
    expect(body.settings.therapist_id).toBe("a");
    expect(body.historicalBillingOnly).toBe(true);
    expect(body.sessions.map((s) => s.id)).toEqual(["a-session", "a-legacy"]);
    expect(JSON.stringify(body)).not.toMatch(/Current|HEALTH_SENTINEL|TOKEN_SENTINEL/);
  });

  it("does not turn a caller-selected billing coach into foreign access", async () => {
    as("b");
    expect((await load(request("?id=case&therapistId=a"))).status).toBe(403);
    as("admin");
    expect((await load(request("?invoiceId=invoice-a&therapistId=b"))).status).toBe(403);
  });

  it("does not give B A's sessions or latest invoice through current assignment", async () => {
    as("b");
    const response = await load(request("?id=case"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.invoice.id).toBe("invoice-b");
    expect(body.historicalBillingOnly).toBe(false);
    expect(body.sessions.map((s) => s.id)).toEqual(["b-session"]);
    expect(body.anfrage.email).toBe("current@example.invalid");
    expect(JSON.stringify(body)).not.toMatch(/HEALTH_SENTINEL|TOKEN_SENTINEL|invoice-a|Historical/);
    expect((await load(request("?invoiceId=invoice-a"))).status).toBe(403);
    expect((await list(request("?therapist_id=a"))).status).toBe(403);
  });

  it("returns no foreign invoice when B has not created one", async () => {
    as("b");
    state.rows.invoices.pop();
    expect((await (await load(request("?id=case"))).json()).invoice).toBeNull();
  });

  it("denies request probing without an assignment or own billing record", async () => {
    state.rows.sessions = []; state.rows.invoices = [];
    expect((await load(request("?id=case"))).status).toBe(403);
    expect(state.reads.filter((r) => r.table === "anfragen")).toHaveLength(1);
  });

  it("limits the historical session overview to billing fields without current case identity/status", async () => {
    const response = await therapistSessions(request());
    expect(response.status).toBe(200);
    const rows = (await response.json()).data;
    expect(rows.map((s) => s.id)).toEqual(["a-legacy", "a-session"]);
    expect(rows.every((s) => Object.keys(s.anfragen).join() === "invoice_with_vat")).toBe(true);
    expect(JSON.stringify(rows)).not.toMatch(/HEALTH_SENTINEL|Current|status|2099/);
  });

  it("preserves current-coach neutral billing fields and admin tax inputs without health reads", async () => {
    as("b");
    const response = await therapistSessions(request());
    expect((await response.json()).data[0].anfragen).toEqual({
      vorname: "Current", nachname: "Identity", invoice_with_vat: false,
    });

    as("admin");
    const admin = await adminSessions(request());
    expect(admin.status).toBe(200);
    expect(JSON.stringify(await admin.json())).not.toMatch(/HEALTH_SENTINEL|TOKEN_SENTINEL|"status"/);
    expect(state.reads.filter((r) => r.table === "anfragen" || r.table === "sessions")
      .every((r) => !r.columns.includes("*"))).toBe(true);
  });

  it("preserves the historical VAT billing input without disclosing current case identity", async () => {
    state.rows.anfragen[0].invoice_with_vat = true;
    const body = await (await therapistSessions(request())).json();
    expect(body.data.every((s) => s.anfragen.invoice_with_vat === true)).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/Current|Identity|assigned_therapist_id/);
  });

  it.each([
    ["existing invoice", { id: "invoice-a", total_gross: 1 }],
    ["new invoice", invoicePayload({ line_items: [{ session_id: "a-session" }] })],
  ])("historical read access cannot edit %s", async (_name, payload) => {
    expect((await save(request("", payload))).status).toBe(403);
    expect(state.writes).toEqual([]);
  });

  it("prevents session deletion for both former A and newly assigned B", async () => {
    expect((await deleteSession(request("", { sessionId: "a-session" }))).status).toBe(403);
    as("b");
    expect((await deleteSession(request("", { sessionId: "a-session" }))).status).toBe(403);
    expect(state.writes).toEqual([]);
  });

  it("allows deletion only for an own session on a currently assigned case", async () => {
    as("b");
    expect((await deleteSession(request("", { sessionId: "b-session" }))).status).toBe(200);
    expect(state.writes).toEqual([{ table: "sessions", operation: "delete", payload: undefined }]);
  });
});

describe("precise invoice workflows", () => {
  beforeEach(() => as("b"));

  it.each([
    [{ session_id: "a-session" }],
    [{ session_id: "a-legacy" }],
    [{ session_id: "missing" }],
  ])("rejects foreign/missing session references on create", async (item) => {
    expect((await save(request("", invoicePayload({ line_items: [item] })))).status).toBe(403);
    expect(state.writes).toEqual([]);
  });

  it("rejects sessions belonging to a different request even for the same owner", async () => {
    state.rows.sessions.find((s) => s.id === "b-session").anfrage_id = "other-case";
    expect((await save(request("", invoicePayload()))).status).toBe(403);
  });

  it("preserves current-owner creation and manual billing without session references", async () => {
    const own = await save(request("", invoicePayload({ therapist_id: "a" })));
    expect(own.status).toBe(200);
    expect((await own.json()).data.therapist_id).toBe("b");
    expect((await save(request("", invoicePayload({ line_items: [{ description: "Manual billing", total: 15 }] })))).status).toBe(200);
  });

  it("preserves own invoice updates but cannot rebind the invoice to another request", async () => {
    expect((await save(request("", { id: "invoice-b", total_gross: 85 }))).status).toBe(200);
    const rebound = await save(request("", { id: "invoice-b", anfrage_id: "other-case" }));
    expect(rebound.status).toBe(403);
    expect(state.rows.invoices[1].anfrage_id).toBe("case");
  });

  it("rejects mixed-owner references on update and sending before provider work", async () => {
    const malicious = [{ session_id: "a-session" }];
    expect((await save(request("", { id: "invoice-b", line_items: malicious }))).status).toBe(403);
    state.rows.invoices[1].line_items = malicious;
    expect((await send(request("", {
      invoiceId: "invoice-b", to: "current@example.invalid",
    }))).status).toBe(403);
    expect(state.sends).not.toHaveBeenCalled();
  });

  it("resends A's unchanged own historical invoice only to its stored precise recipient", async () => {
    as("a");
    const before = structuredClone(state.rows.invoices[0]);
    const response = await send(request("", {
      invoiceId: "invoice-a", to: "BILLING@example.invalid",
    }));
    expect(response.status).toBe(200);
    expect(state.sends).toHaveBeenCalledWith(expect.objectContaining({
      to: "billing@example.invalid",
      reply_to: "a@example.invalid",
      subject: "Ihre Rechnung",
      text: "Guten Tag,\n\nim Anhang erhalten Sie Ihre Rechnung.\n\nFreundliche Grüße\nPoise",
    }));
    expect(state.rows.invoices[0]).toEqual(before);
    expect(state.reads.some((r) => r.table === "anfragen")).toBe(false);
  });

  it("cannot send A's invoice just because B is now assigned", async () => {
    const response = await send(request("", {
      invoiceId: "invoice-a", to: "billing@example.invalid",
    }));
    expect(response.status).toBe(403);
    expect(state.sends).not.toHaveBeenCalled();
  });

  it.each(["a", "b", "admin"])("rejects arbitrary billing message content for role identity %s", async (actor) => {
    as(actor);
    for (const custom of [
      { subject: "Synthetic care follow-up" },
      { message: "Synthetic health content" },
      { subject: "" }, { message: null },
    ]) {
      const response = await send(request("", {
        invoiceId: actor === "b" ? "invoice-b" : "invoice-a",
        to: actor === "b" ? "current@example.invalid" : "billing@example.invalid",
        ...custom,
      }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "CUSTOM_BILLING_MESSAGE_NOT_ALLOWED" });
    }
    expect(state.sends).not.toHaveBeenCalled();
    expect(state.writes).toEqual([]);
  });

  it("keeps historical invoice/status unchanged on a provider failure", async () => {
    as("a");
    const before = structuredClone(state.rows.invoices);
    state.sends.mockResolvedValue({ data: null, error: { message: "Synthetic failure" } });
    const response = await send(request("", {
      invoiceId: "invoice-a", to: "billing@example.invalid",
    }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "INVOICE_SEND_FAILED" });
    expect(state.rows.invoices).toEqual(before);
    expect(state.writes).toEqual([]);
  });

  it.each(["other@example.invalid", ["billing@example.invalid"], "billing@example.invalid,other@example.invalid"])(
    "blocks recipient override %j", async (to) => {
      as("a");
      expect((await send(request("", { invoiceId: "invoice-a", to }))).status).toBe(403);
      expect(state.sends).not.toHaveBeenCalled();
    },
  );

  it("does not infer legacy owner aliases from client input or an unverified auth mapping", () => {
    expect(billingOwnerIds({ id: "a", user_id: "auth-b" }, { id: "auth-a" })).toEqual(["a"]);
    expect(invoiceRecipientMatches("x@example.invalid", "x@example.invalid\r\nBcc: other@example.invalid")).toBe(false);
  });

  it("fails closed on unavailable session ownership validation", async () => {
    state.failure = "sessions";
    expect((await save(request("", invoicePayload()))).status).toBe(403);
    expect(state.writes).toEqual([]);
  });
});

describe("billing role allowlists", () => {
  it.each([
    ["load", load, "?id=case", undefined],
    ["list", list, "", undefined],
    ["save", save, "", invoicePayload()],
    ["send", send, "", { invoiceId: "invoice-a", to: "billing@example.invalid" }],
    ["therapist sessions", therapistSessions, "", undefined],
    ["admin sessions", adminSessions, "", undefined],
    ["delete session", deleteSession, "", { sessionId: "a-session" }],
  ])("rejects unsupported roles for %s", async (_name, route, path, body) => {
    as("other");
    expect((await route(request(path, body))).status).toBe(403);
    expect(state.writes).toEqual([]);
    expect(state.sends).not.toHaveBeenCalled();
  });

  describe("atomic billing mutation RPC contracts", () => {
    beforeEach(() => as("b"));

    it.each([
      { status: "paid" }, { created_at: "2020-01-01" }, { updated_at: "2020-01-01" },
      { sevdesk_invoice_id: "foreign" }, { care_version: 0 }, { user_id: "auth-a" },
      { unknown_field: "unexpected" }, { total_gross: "80" }, { invoice_date: {} },
      { client_email: ["extra@example.invalid"] }, { line_items: null },
      { line_items: [{ session_id: "b-session", therapist_id: "a" }] },
      { line_items: [{ session_id: "b-session", total: "80" }] },
    ])("rejects unknown/protected fields or invalid types before RPC: %j", async (extra) => {
      const response = await save(request("", invoicePayload(extra)));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "INVALID_INVOICE_PAYLOAD" });
      expect(state.rpcCalls).toEqual([]);
      expect(state.writes).toEqual([]);
    });

    it("sends server-verified create fields and version to the atomic save, never a table write", async () => {
      const response = await save(request("", invoicePayload({ therapist_id: "a" })));
      expect(response.status).toBe(200);
      expect(state.rpcCalls).toEqual([{
        name: "privacy_save_client_invoice",
        args: {
          p_actor_id: "auth-b", p_invoice_id: null, p_request_id: "case", p_expected_version: 3,
          p_payload: {
            ...invoicePayload(), therapist_id: "b", updated_at: expect.any(String),
          },
        },
      }]);
    });

    it("sends an existing legacy invoice owner and ID unchanged", async () => {
      as("a"); state.rows.anfragen[0].assigned_therapist_id = "a";
      expect((await save(request("", {
        id: "invoice-a", anfrage_id: "case", therapist_id: "b", total_gross: 75,
      }))).status).toBe(200);
      expect(state.rpcCalls[0].args).toMatchObject({
        p_actor_id: "auth-a", p_invoice_id: "invoice-a", p_request_id: "case",
        p_expected_version: 3,
        p_payload: { therapist_id: "auth-a", anfrage_id: "case", total_gross: 75 },
      });
      expect(state.rpcCalls[0].args.p_payload).not.toHaveProperty("id");
      expect(state.rpcCalls[0].args.p_payload).not.toHaveProperty("line_items");
    });

    it("uses the atomic delete with authenticated actor and session, without a direct delete", async () => {
      expect((await deleteSession(request("", { sessionId: "b-session" }))).status).toBe(200);
      expect(state.rpcCalls).toEqual([{
        name: "privacy_delete_care_session",
        args: { p_actor_id: "auth-b", p_session_id: "b-session" },
      }]);
    });

    it("denies a handover occurring between HTTP checks and invoice commit", async () => {
      state.beforeRpc = () => {
        state.rows.anfragen[0].assigned_therapist_id = "a";
        state.rows.anfragen[0].care_version = 4;
      };
      const response = await save(request("", invoicePayload()));
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "CARE_VERSION_CONFLICT" });
      expect(state.writes).toEqual([]);
    });

    it("denies session deletion when handover wins the database request lock", async () => {
      state.beforeRpc = () => { state.rows.anfragen[0].assigned_therapist_id = "a"; };
      expect((await deleteSession(request("", { sessionId: "b-session" }))).status).toBe(403);
      expect(state.writes).toEqual([]);
      expect(state.rows.sessions.some((row) => row.id === "b-session")).toBe(true);
    });

    it.each([undefined, null, -1, 1.5, "invalid", "9223372036854775808"])(
      "fails closed without a usable care version %j", async (version) => {
        state.rows.anfragen[0].care_version = version;
        expect((await save(request("", invoicePayload()))).status).toBe(503);
        expect(state.rpcCalls).toEqual([]);
        expect(state.writes).toEqual([]);
      },
    );

    it("preserves PostgreSQL bigint string precision for the expected version", async () => {
      state.rows.anfragen[0].care_version = "9007199254740993";
      expect((await save(request("", invoicePayload()))).status).toBe(200);
      expect(state.rpcCalls[0].args.p_expected_version).toBe("9007199254740993");
    });

    it.each(["save", "delete"])("fails closed when the %s RPC is missing, throws, or returns malformed data", async (operation) => {
      const run = () => operation === "save"
        ? save(request("", invoicePayload()))
        : deleteSession(request("", { sessionId: "b-session" }));
      state.rpcError = { code: "PGRST202", message: "Function not found" };
      expect((await run()).status).toBe(503);
      state.rpcError = null; state.rpcResult = {};
      expect((await run()).status).toBe(503);
      state.beforeRpc = () => { throw new Error("Synthetic unavailable RPC"); };
      expect((await run()).status).toBe(503);
      expect(state.writes).toEqual([]);
    });

    it.each(["save", "delete"])("requires active roles to be revalidated by %s RPC after preflight", async (operation) => {
      state.beforeRpc = () => { state.rows.team_members.find((m) => m.id === "b").active = false; };
      const response = operation === "save"
        ? await save(request("", invoicePayload()))
        : await deleteSession(request("", { sessionId: "b-session" }));
      expect(response.status).toBe(403);
      expect(state.writes).toEqual([]);
    });
  });
});
