import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sb: null,
  send: vi.fn(),
}));

vi.mock("../../app/api/_lib/server.js", () => ({
  supabaseAdmin: () => mocks.sb,
  json: (data, status = 200) => Response.json(data, { status }),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

import { POST } from "../../app/api/send-video-link/route.js";

const PERSONAL_LINK = "https://video.example.invalid/personal";
const GENERAL_LINK = "https://video.example.invalid/general";

function request(body = { requestId: "request-1" }) {
  return new Request("https://app.example.invalid/api/send-video-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setup({
  anfrage = {
    id: "request-1",
    email: "client@example.invalid",
    vorname: "Testperson",
    assigned_therapist_id: "coach-1",
    meeting_link_override: null,
  },
  requestError = null,
  settings = { meeting_link: GENERAL_LINK },
  settingsError = null,
} = {}) {
  const reads = [];
  const writes = [];
  mocks.sb = {
    from: vi.fn((table) => {
      let fields;
      let payload;
      const filters = [];
      const resolve = () => {
        if (payload) {
          writes.push({ table, payload, filters });
          return { error: null };
        }
        reads.push({ table, fields, filters });
        if (table === "anfragen") {
          return { data: anfrage, error: requestError };
        }
        if (table === "therapist_booking_settings") {
          return { data: settings, error: settingsError };
        }
        throw new Error(`Unexpected table: ${table}`);
      };
      const chain = {
        select: (value) => { fields = value; return chain; },
        eq: (key, value) => { filters.push([key, value]); return chain; },
        update: (value) => { payload = value; return chain; },
        single: async () => resolve(),
        maybeSingle: async () => resolve(),
        then: (onFulfilled, onRejected) =>
          Promise.resolve(resolve()).then(onFulfilled, onRejected),
      };
      return chain;
    }),
  };
  return { reads, writes };
}

describe("send video link route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "synthetic-test-key");
    vi.stubGlobal("fetch", vi.fn(() => {
      throw new Error("Unexpected external call");
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.send.mockResolvedValue({ data: { id: "mail-1" }, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends the general link using the assigned coach when there is no override", async () => {
    const { reads, writes } = setup();
    const response = await POST(request({
      requestId: "request-1",
      therapist_id: "untrusted-coach",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      videoLink: GENERAL_LINK,
    });
    expect(reads).toEqual([
      { table: "anfragen", fields: "*", filters: [["id", "request-1"]] },
      {
        table: "therapist_booking_settings",
        fields: "meeting_link",
        filters: [["therapist_id", "coach-1"]],
      },
    ]);
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      to: "client@example.invalid",
      html: expect.stringContaining(`href="${GENERAL_LINK}"`),
    }));
    expect(writes).toEqual([{
      table: "anfragen",
      payload: { video_link_sent_at: expect.any(String) },
      filters: [["id", "request-1"]],
    }]);
  });

  it.each([
    ["only a personal link", null],
    ["both links", { meeting_link: GENERAL_LINK }],
  ])("uses the personal link with %s", async (_label, settings) => {
    const { reads } = setup({
      anfrage: {
        id: "request-1",
        email: "client@example.invalid",
        assigned_therapist_id: "coach-1",
        meeting_link_override: PERSONAL_LINK,
      },
      settings,
    });
    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      videoLink: PERSONAL_LINK,
    });
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      html: expect.stringContaining(`href="${PERSONAL_LINK}"`),
    }));
    expect(mocks.send.mock.calls[0][0].html).not.toContain(GENERAL_LINK);
    expect(reads.map((read) => read.table)).toEqual(["anfragen"]);
  });

  it.each([
    ["empty settings link", { meeting_link: null }],
    ["missing settings row", null],
  ])("returns MISSING_VIDEO_LINK for %s and no override", async (_label, settings) => {
    const { writes } = setup({ settings });
    const response = await POST(request());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "MISSING_VIDEO_LINK" });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("does not load settings without an assigned coach", async () => {
    const { reads, writes } = setup({
      anfrage: { id: "request-1", email: "client@example.invalid" },
    });
    const response = await POST(request());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "MISSING_VIDEO_LINK" });
    expect(reads.map((read) => read.table)).toEqual(["anfragen"]);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("reports a settings query failure instead of treating it as a missing link", async () => {
    const { writes } = setup({
      settings: null,
      settingsError: { code: "TEST_DB_ERROR" },
    });
    const response = await POST(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "BOOKING_SETTINGS_LOAD_FAILED",
    });
    expect(console.error).toHaveBeenCalledWith(
      "SEND VIDEO LINK BOOKING SETTINGS LOAD ERROR:",
      { code: "TEST_DB_ERROR" },
    );
    expect(mocks.send).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("returns ANFRAGE_NOT_FOUND when the request is missing", async () => {
    const { writes } = setup({ anfrage: null, requestError: { code: "PGRST116" } });
    const response = await POST(request());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "ANFRAGE_NOT_FOUND" });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("returns MISSING_EMAIL before loading settings or sending", async () => {
    const { reads, writes } = setup({
      anfrage: { id: "request-1", assigned_therapist_id: "coach-1", email: null },
    });
    const response = await POST(request());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "MISSING_EMAIL" });
    expect(reads.map((read) => read.table)).toEqual(["anfragen"]);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("returns MISSING_REQUEST_ID without querying the database", async () => {
    setup();
    const response = await POST(request({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "MISSING_REQUEST_ID" });
    expect(mocks.sb.from).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
