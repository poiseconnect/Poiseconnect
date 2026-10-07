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

import { POST } from "../../app/api/admin-reengage/route.js";

const ADMIN_MEMBER = { id: "member-admin-1", role: "admin", active: true };
const BATCH_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_A = "11111111-1111-4111-8111-111111111111";
const REQUEST_B = "33333333-3333-4333-8333-333333333333";

function requestFor(body, { auth = "Bearer test-token" } = {}) {
  return new Request("https://app.example.invalid/api/admin-reengage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });
}

// Default: Anfrage existiert, hat den erforderlichen Status und keine
// Coach-Zuordnung. Pro Testfall einzeln überschreibbar.
function defaultFreshRowFor(anfragenRows) {
  return (id) => anfragenRows.find((r) => r.id === id) || null;
}

function buildSupabase({
  memberResult = { data: ADMIN_MEMBER, error: null },
  anfragenRows = [],
  // id -> Error-Objekt: simuliert einen Lesefehler bei der Frischeprüfung.
  freshReadErrorFor = {},
  // id -> Status-String ("sent"|"queued"|"unknown"|"failed"): vorhandener
  // Log-Eintrag für lookupExistingLogStatus bei abgelehnter Reservierung.
  existingLogStatusFor = {},
  // id -> true: der Lookup des vorhandenen Log-Status selbst schlägt fehl.
  logLookupErrorFor = {},
  rpcImpl,
  // (table, payload) => Error|null: erlaubt es, einzelne Update-Aufrufe
  // gezielt fehlschlagen zu lassen (z. B. Log-Abschluss oder Timestamp).
  updateErrorFor,
} = {}) {
  const updateCalls = [];
  const rpcMock = rpcImpl || vi.fn(async () => ({ data: null, error: null }));
  const getFreshRow = defaultFreshRowFor(anfragenRows);

  function updateChain(table, payload) {
    updateCalls.push({ table, payload });
    const error = updateErrorFor ? updateErrorFor(table, payload) || null : null;
    return { eq: vi.fn(async () => ({ error })) };
  }

  const sb = {
    from: vi.fn((table) => {
      if (table === "team_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => memberResult),
            })),
          })),
        };
      }
      if (table === "anfragen") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_col, id) => ({
              maybeSingle: vi.fn(async () => {
                if (freshReadErrorFor[id]) {
                  return { data: null, error: freshReadErrorFor[id] };
                }
                return { data: getFreshRow(id), error: null };
              }),
            })),
          })),
          update: vi.fn((payload) => updateChain("anfragen", payload)),
        };
      }
      if (table === "anfragen_reengagement_log") {
        return {
          update: vi.fn((payload) => updateChain("anfragen_reengagement_log", payload)),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn((_col, anfrageId) => ({
                maybeSingle: vi.fn(async () => {
                  if (logLookupErrorFor[anfrageId]) {
                    return { data: null, error: new Error("lookup failed") };
                  }
                  const status = existingLogStatusFor[anfrageId];
                  return { data: status ? { status } : null, error: null };
                }),
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: rpcMock,
  };

  return { sb, updateCalls, rpcMock };
}

describe("admin-reengage route", () => {
  beforeEach(() => {
    getUserFromBearer.mockReset();
    supabaseAdmin.mockReset();
    global.fetch = vi.fn();
    process.env.RESEND_API_KEY = "test-resend-key";
  });

  it("1) rejects requests without an Authorization header", async () => {
    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }, { auth: null }));
    expect(res.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("2) rejects an authenticated non-admin user", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const { sb } = buildSupabase({ memberResult: { data: { id: "m1", role: "therapist", active: true }, error: null } });
    supabaseAdmin.mockReturnValue(sb);

    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));
    expect(res.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("3) sends one personalized mail for a valid request in the required status", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "client-a@example.invalid", vorname: "Anna", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
    ];
    const { sb } = buildSupabase({
      anfragenRows,
      rpcImpl: vi.fn(async () => ({ data: { id: "log-1" }, error: null })),
    });
    supabaseAdmin.mockReturnValue(sb);

    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "resend-message-1" }),
    });

    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.results).toEqual([{ id: REQUEST_A, result: "sent" }]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers["Idempotency-Key"]).toBe(`reengage:${BATCH_ID}:${REQUEST_A}`);
    expect(init.headers.Authorization).toBe("Bearer test-resend-key");
    const sentBody = JSON.parse(init.body);
    expect(sentBody.to).toBe("client-a@example.invalid");
    expect(sentBody.reply_to).toBe("hallo@mypoise.de");
    expect(sentBody.html).toContain("Hallo Anna,");
  });

  it("4) skips a request whose status has changed in the meantime (found at the fresh check after reservation)", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "client-a@example.invalid", vorname: "Anna", status: "active", assigned_therapist_id: null },
    ];
    const { sb, updateCalls } = buildSupabase({
      anfragenRows,
      rpcImpl: vi.fn(async () => ({ data: { id: "log-1" }, error: null })),
    });
    supabaseAdmin.mockReturnValue(sb);

    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));
    const body = await res.json();

    expect(body.results).toEqual([{ id: REQUEST_A, result: "skipped", reason: "STATUS_CHANGED" }]);
    expect(global.fetch).not.toHaveBeenCalled();
    // Die bereits erteilte Reservierung wird terminal abgeschlossen (nicht
    // als "queued" liegen gelassen).
    const logUpdate = updateCalls.find((c) => c.table === "anfragen_reengagement_log");
    expect(logUpdate.payload).toMatchObject({ status: "failed", error_code: "STATUS_CHANGED" });
  });

  it("5) reports a safe failure for a missing/invalid email address", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "not-an-email", vorname: "Anna", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
    ];
    const { sb } = buildSupabase({
      anfragenRows,
      rpcImpl: vi.fn(async () => ({ data: { id: "log-1" }, error: null })),
    });
    supabaseAdmin.mockReturnValue(sb);

    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));
    const body = await res.json();

    expect(body.results).toEqual([{ id: REQUEST_A, result: "failed", reason: "INVALID_EMAIL" }]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("6) denies a second concurrent/duplicate reservation for the same batch+request (prior status unknown)", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "client-a@example.invalid", vorname: "Anna", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
    ];
    // Simuliert: Reservierung bereits durch einen parallelen Request vergeben.
    // Kein vorhandener Log-Eintrag auffindbar -> priorStatus nicht bekannt.
    const { sb } = buildSupabase({
      anfragenRows,
      rpcImpl: vi.fn(async () => ({ data: null, error: null })),
    });
    supabaseAdmin.mockReturnValue(sb);

    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));
    const body = await res.json();

    expect(body.results).toEqual([
      { id: REQUEST_A, result: "skipped", reason: "ALREADY_HANDLED", priorStatus: null, priorStatusKnown: false },
    ]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("7) reports successes and failures separately within one batch (no blanket success)", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "client-a@example.invalid", vorname: "Anna", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
      { id: REQUEST_B, email: "client-b@example.invalid", vorname: "Boris", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
    ];
    const { sb } = buildSupabase({
      anfragenRows,
      rpcImpl: vi.fn(async ({ p_anfrage_id }) => ({
        data: { id: `log-${p_anfrage_id}` },
        error: null,
      })),
    });
    supabaseAdmin.mockReturnValue(sb);

    global.fetch.mockImplementation(async (url, init) => {
      const payload = JSON.parse(init.body);
      if (payload.to === "client-a@example.invalid") {
        return { ok: true, status: 200, json: async () => ({ id: "ok-1" }) };
      }
      return { ok: false, status: 400, json: async () => ({ message: "invalid" }) };
    });

    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A, REQUEST_B] }));
    const body = await res.json();

    expect(body.results).toEqual([
      { id: REQUEST_A, result: "sent" },
      { id: REQUEST_B, result: "failed", reason: "SEND_FAILED" },
    ]);
  });

  it("8) a repeated call for the same batch does not resend to already-successful recipients, and distinguishes sent/queued/unknown", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "client-a@example.invalid", vorname: "Anna", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
    ];
    // Zweiter Aufruf desselben Vorgangs: Eintrag ist bereits 'sent' ->
    // reserve_reengagement_attempt lehnt ab (data: null).
    const { sb } = buildSupabase({
      anfragenRows,
      existingLogStatusFor: { [REQUEST_A]: "sent" },
      rpcImpl: vi.fn(async () => ({ data: null, error: null })),
    });
    supabaseAdmin.mockReturnValue(sb);

    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));
    const body = await res.json();

    expect(body.results).toEqual([
      { id: REQUEST_A, result: "skipped", reason: "ALREADY_HANDLED", priorStatus: "sent", priorStatusKnown: true },
    ]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("8b) repeating a batch where the prior attempt is still 'queued' or 'unknown' is reported distinctly (not as a blanket success)", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "client-a@example.invalid", vorname: "Anna", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
    ];
    const { sb } = buildSupabase({
      anfragenRows,
      existingLogStatusFor: { [REQUEST_A]: "unknown" },
      rpcImpl: vi.fn(async () => ({ data: null, error: null })),
    });
    supabaseAdmin.mockReturnValue(sb);

    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));
    const body = await res.json();

    expect(body.results).toEqual([
      { id: REQUEST_A, result: "skipped", reason: "ALREADY_HANDLED", priorStatus: "unknown", priorStatusKnown: true },
    ]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("9) an unknown provider outcome (e.g. 500) is not treated as a safe failure", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "client-a@example.invalid", vorname: "Anna", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
    ];
    const { sb, updateCalls } = buildSupabase({
      anfragenRows,
      rpcImpl: vi.fn(async () => ({ data: { id: "log-1" }, error: null })),
    });
    supabaseAdmin.mockReturnValue(sb);

    global.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));
    const body = await res.json();

    expect(body.results).toEqual([{ id: REQUEST_A, result: "unknown", reason: "SEND_RESULT_UNKNOWN" }]);

    const logUpdate = updateCalls.find((c) => c.table === "anfragen_reengagement_log");
    expect(logUpdate.payload.status).toBe("unknown");

    // Darf NICHT als 'failed' markiert worden sein (sonst würde es fälschlich
    // als sicher wiederholbar gelten).
    expect(logUpdate.payload.status).not.toBe("failed");
  });

  it("10) does not modify anfragen.status or assigned_therapist_id", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "client-a@example.invalid", vorname: "Anna", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
    ];
    const { sb, updateCalls } = buildSupabase({
      anfragenRows,
      rpcImpl: vi.fn(async () => ({ data: { id: "log-1" }, error: null })),
    });
    supabaseAdmin.mockReturnValue(sb);

    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "ok-1" }) });

    await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));

    const anfragenUpdate = updateCalls.find((c) => c.table === "anfragen");
    expect(anfragenUpdate.payload).not.toHaveProperty("status");
    expect(anfragenUpdate.payload).not.toHaveProperty("assigned_therapist_id");
    expect(Object.keys(anfragenUpdate.payload)).toEqual(["reengagement_last_sent_at"]);
  });

  it("11) uses the configured sender and reply-to address", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "client-a@example.invalid", vorname: "Anna", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
    ];
    const { sb } = buildSupabase({
      anfragenRows,
      rpcImpl: vi.fn(async () => ({ data: { id: "log-1" }, error: null })),
    });
    supabaseAdmin.mockReturnValue(sb);

    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "ok-1" }) });

    await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));

    const sentBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(sentBody.from).toBe("Poise <noreply@mypoise.de>");
    expect(sentBody.reply_to).toBe("hallo@mypoise.de");
  });

  it("12) never logs personal data (email/name) to the console", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "client-a@example.invalid", vorname: "Anna", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
    ];
    const { sb } = buildSupabase({
      anfragenRows,
      rpcImpl: vi.fn(async () => ({ data: { id: "log-1" }, error: null })),
    });
    supabaseAdmin.mockReturnValue(sb);

    global.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));

    for (const spy of [logSpy, errorSpy, warnSpy]) {
      for (const call of spy.mock.calls) {
        const joined = call.map((a) => JSON.stringify(a)).join(" ");
        expect(joined).not.toContain("client-a@example.invalid");
        expect(joined).not.toContain("Anna");
      }
    }

    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("13) a second request in the batch changes status before its fresh check runs: it is skipped, the first still sends", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "client-a@example.invalid", vorname: "Anna", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
      // REQUEST_B hat zwischenzeitlich (zwischen Batch-Start und seiner
      // eigenen Frischeprüfung) einen anderen Status erhalten.
      { id: REQUEST_B, email: "client-b@example.invalid", vorname: "Boris", status: "termin_bestaetigt", assigned_therapist_id: null },
    ];
    const { sb } = buildSupabase({
      anfragenRows,
      rpcImpl: vi.fn(async ({ p_anfrage_id }) => ({ data: { id: `log-${p_anfrage_id}` }, error: null })),
    });
    supabaseAdmin.mockReturnValue(sb);

    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "ok-1" }) });

    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A, REQUEST_B] }));
    const body = await res.json();

    expect(body.results).toEqual([
      { id: REQUEST_A, result: "sent" },
      { id: REQUEST_B, result: "skipped", reason: "STATUS_CHANGED" },
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("14) a coach gets assigned to a request during the batch: it is skipped without sending", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      {
        id: REQUEST_A,
        email: "client-a@example.invalid",
        vorname: "Anna",
        status: "admin_vorschlaege_gesendet",
        assigned_therapist_id: "coach-123",
      },
    ];
    const { sb, updateCalls } = buildSupabase({
      anfragenRows,
      rpcImpl: vi.fn(async () => ({ data: { id: "log-1" }, error: null })),
    });
    supabaseAdmin.mockReturnValue(sb);

    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));
    const body = await res.json();

    expect(body.results).toEqual([{ id: REQUEST_A, result: "skipped", reason: "COACH_ALREADY_ASSIGNED" }]);
    expect(global.fetch).not.toHaveBeenCalled();
    const logUpdate = updateCalls.find((c) => c.table === "anfragen_reengagement_log");
    expect(logUpdate.payload).toMatchObject({ status: "failed", error_code: "COACH_ALREADY_ASSIGNED" });
  });

  it("15) the fresh re-read before sending fails: no send with stale data", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "client-a@example.invalid", vorname: "Anna", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
    ];
    const { sb } = buildSupabase({
      anfragenRows,
      freshReadErrorFor: { [REQUEST_A]: new Error("connection reset") },
      rpcImpl: vi.fn(async () => ({ data: { id: "log-1" }, error: null })),
    });
    supabaseAdmin.mockReturnValue(sb);

    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));
    const body = await res.json();

    expect(body.results).toEqual([{ id: REQUEST_A, result: "failed", reason: "REFRESH_READ_FAILED" }]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("16) provider accepts the mail, but saving the log completion fails: reported as sent with a warning, no second send", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "client-a@example.invalid", vorname: "Anna", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
    ];
    const { sb } = buildSupabase({
      anfragenRows,
      rpcImpl: vi.fn(async () => ({ data: { id: "log-1" }, error: null })),
      updateErrorFor: (table) =>
        table === "anfragen_reengagement_log" ? new Error("db write failed") : null,
    });
    supabaseAdmin.mockReturnValue(sb);

    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "ok-1" }) });

    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));
    const body = await res.json();

    expect(body.results).toEqual([{ id: REQUEST_A, result: "sent", warning: "LOG_UPDATE_FAILED" }]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("17) log completion succeeds but the display timestamp update fails: provider acceptance is preserved, no duplicate send", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "client-a@example.invalid", vorname: "Anna", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
    ];
    const { sb } = buildSupabase({
      anfragenRows,
      rpcImpl: vi.fn(async () => ({ data: { id: "log-1" }, error: null })),
      updateErrorFor: (table) => (table === "anfragen" ? new Error("timestamp write failed") : null),
    });
    supabaseAdmin.mockReturnValue(sb);

    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "ok-1" }) });

    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));
    const body = await res.json();

    expect(body.results).toEqual([{ id: REQUEST_A, result: "sent", warning: "TIMESTAMP_UPDATE_FAILED" }]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("18) a network/timeout exception and a failed save of 'unknown': reservation stays blocking, no blind retry", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "client-a@example.invalid", vorname: "Anna", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
    ];
    const { sb, updateCalls } = buildSupabase({
      anfragenRows,
      rpcImpl: vi.fn(async () => ({ data: { id: "log-1" }, error: null })),
      updateErrorFor: (table) =>
        table === "anfragen_reengagement_log" ? new Error("db write failed") : null,
    });
    supabaseAdmin.mockReturnValue(sb);

    // batchId bleibt dabei unverändert erhalten (derselbe Vorgang, kein neuer).
    global.fetch.mockImplementation(async () => {
      throw new Error("network timeout");
    });

    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));
    const body = await res.json();

    expect(body.batchId).toBe(BATCH_ID);
    expect(body.results).toEqual([
      { id: REQUEST_A, result: "unknown", reason: "SEND_RESULT_UNKNOWN", warning: "LOG_UPDATE_FAILED" },
    ]);
    const logUpdate = updateCalls.find((c) => c.table === "anfragen_reengagement_log");
    expect(logUpdate.payload.status).toBe("unknown");
  });

  it("19) opening the preview does not call the send endpoint (documented UI contract, not separately testable at route level)", () => {
    // Hinweis: Der Vorschau-Dialog im Dashboard ruft POST /api/admin-reengage
    // ausschließlich nach ausdrücklichem Klick auf "Senden" auf. Da dies ein
    // reines Frontend-Verhalten von app/dashboard/DashboardFull.jsx ist (kein
    // Komponenten-Test-Setup für diese Datei vorhanden, siehe Abschlussbericht
    // zu offenen Testlücken), wird hier nur der Vertrag dokumentiert: Dieser
    // Testfall ruft absichtlich POST() nicht auf.
    expect(true).toBe(true);
  });

  it("20) status and coach assignment remain unchanged even when the outcome is 'unknown'", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const anfragenRows = [
      { id: REQUEST_A, email: "client-a@example.invalid", vorname: "Anna", status: "admin_vorschlaege_gesendet", assigned_therapist_id: null },
    ];
    const { sb, updateCalls } = buildSupabase({
      anfragenRows,
      rpcImpl: vi.fn(async () => ({ data: { id: "log-1" }, error: null })),
    });
    supabaseAdmin.mockReturnValue(sb);

    global.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await POST(requestFor({ batchId: BATCH_ID, requestIds: [REQUEST_A] }));

    const anfragenUpdates = updateCalls.filter((c) => c.table === "anfragen");
    for (const update of anfragenUpdates) {
      expect(update.payload).not.toHaveProperty("status");
      expect(update.payload).not.toHaveProperty("assigned_therapist_id");
    }
  });

  it("rejects a malformed batchId", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const { sb } = buildSupabase();
    supabaseAdmin.mockReturnValue(sb);

    const res = await POST(requestFor({ batchId: "not-a-uuid", requestIds: [REQUEST_A] }));
    expect(res.status).toBe(400);
  });

  it("rejects an empty selection", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const { sb } = buildSupabase();
    supabaseAdmin.mockReturnValue(sb);

    const res = await POST(requestFor({ batchId: BATCH_ID, requestIds: [] }));
    expect(res.status).toBe(400);
  });
});
