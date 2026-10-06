import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeFormTeamMembers, toFormTeamMember } from "../../app/lib/formTeamMembers.js";
import { SELF_PAYMENT_NOTICE } from "../../app/lib/coachingCosts.js";

const mocks = vi.hoisted(() => ({
  sb: null,
  send: vi.fn(),
  ensureConversation: vi.fn(),
  events: { get: vi.fn(), list: vi.fn(), insert: vi.fn() },
  team: [
    { id: "booking-coach", name: "Testcoach", email: "coach@example.invalid", calendar_mode: "booking", preis_std: 150, preis_ermaessigt: 120, paarcoaching_preis: 240, paarcoaching_dauer_min: 90 },
    { id: "proposal-coach", name: "Testcoach", email: "coach@example.invalid", calendar_mode: "proposal", preis_std: 150, preis_ermaessigt: 120, paarcoaching_preis: 240, paarcoaching_dauer_min: 90 },
    { id: "missing-coach", name: "Testcoach ohne Tarife", email: "coach@example.invalid", calendar_mode: "proposal", preis_std: null, preis_ermaessigt: null },
  ],
}));

vi.mock("../../app/lib/teamData.js", () => ({ teamData: mocks.team }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => mocks.sb }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));
vi.mock("googleapis", () => ({ google: { calendar: () => ({ events: mocks.events }) } }));
vi.mock("../../app/api/_lib/server.js", () => ({
  supabaseAdmin: () => mocks.sb,
  oauthClient: () => ({ setCredentials: vi.fn() }),
  json: (data, status = 200) => Response.json(data, { status }),
}));
vi.mock("../../app/lib/messaging/conversations.js", () => ({
  ensureOpenConversation: mocks.ensureConversation,
}));

import { POST as book } from "../../app/api/booking/book/route.js";
import { POST as submit } from "../../app/api/form-submit/route.js";

const START = "2026-10-12T08:00:00.000Z";
const END = "2026-10-12T08:30:00.000Z";
const CLIENT_EMAIL = "client@example.invalid";

function request(body) {
  return new Request("https://app.example.invalid/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildSupabase({ coachId, coachingType = "einzel", profile = {}, profileError = null }) {
  const writes = [];
  const reads = [];
  const anfrage = {
    id: "request-1",
    vorname: "Testperson",
    email: CLIENT_EMAIL,
    assigned_therapist_id: coachId,
    coaching_typ: coachingType,
    honorar_klient: 999,
    booking_token: "synthetic-booking-token",
  };
  const sb = {
    from: (table) => {
      let operation = "select";
      let fields = "";
      let payload;
      const filters = [];
      const resolve = () => {
        if (operation !== "select") {
          writes.push({ table, operation, payload });
          return { data: table === "blocked_slots" ? [{ id: "block-1" }] : { id: "session-1" }, error: null };
        }
        reads.push({ table, fields, filters });
        if (table === "anfragen") return { data: anfrage, error: null };
        if (table === "team_members") {
          if (fields.includes("profile_preis_std")) {
            return { data: profile === null ? null : { id: coachId, ...profile }, error: profileError };
          }
          return { data: { id: coachId, name: "Testcoach", email: "coach@example.invalid" }, error: null };
        }
        if (table === "therapist_booking_settings") {
          return { data: { booking_enabled: true, selected_calendar_id: "test-calendar", time_zone: "Europe/Vienna", meeting_link: "https://video.example.invalid/test" }, error: null };
        }
        if (table === "blocked_slots" || table === "sessions") return { data: [], error: null };
        throw new Error(`Unexpected table: ${table}`);
      };
      const chain = {
        select: (value = "") => { fields = value; return chain; },
        eq: (key, value) => { filters.push([key, value]); return chain; },
        insert: (value) => { operation = "insert"; payload = value; return chain; },
        update: (value) => { operation = "update"; payload = value; return chain; },
        single: async () => resolve(),
        maybeSingle: async () => resolve(),
        then: (onFulfilled, onRejected) => Promise.resolve(resolve()).then(onFulfilled, onRejected),
      };
      return chain;
    },
  };
  return { sb, writes, reads };
}

async function runMode(mode, options = {}) {
  const coachId = options.coachId || `${mode}-coach`;
  const state = buildSupabase({ ...options, coachId });
  mocks.sb = state.sb;
  const body = mode === "booking"
    ? { token: "synthetic-booking-token", start: START, bookingType: "erstgespraech", durationMin: 30, ...options.body }
    : { anfrageId: "request-1", vorname: "Testperson", email: CLIENT_EMAIL, wunschtherapeut: "Testcoach", assigned_therapist_id: coachId, coaching_typ: options.coachingType || "einzel", ...options.body };
  const response = await (mode === "booking" ? book : submit)(request(body));
  return { ...state, response, clientMail: mocks.send.mock.calls.map(([mail]) => mail).find((mail) => mail.to === CLIENT_EMAIL) };
}

describe("actual first coaching emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-test-key");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected external call"); }));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.send.mockResolvedValue({ data: { id: "mail-1" }, error: null });
    mocks.ensureConversation.mockResolvedValue({ id: "conversation-1" });
    const availability = {
      id: "availability-1",
      summary: "POISE VERFÜGBAR",
      start: { dateTime: "2026-10-12T07:00:00.000Z" },
      end: { dateTime: "2026-10-12T12:00:00.000Z" },
    };
    mocks.events.list.mockResolvedValue({ data: { items: [availability] } });
    mocks.events.get.mockResolvedValue({ data: availability });
    mocks.events.insert.mockResolvedValue({ data: { id: "booked-event-1" } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe.each(["booking", "proposal"])("%s mode", (mode) => {
    it.each([
      ["published overrides with reduced tariff", { profile_preis_std: "175,50", profile_preis_ermaessigt: "110", profile_name: "Veröffentlichter Testcoach" }, "einzel", "175,5 €", "110 €", "60 Min."],
      ["static fallback", {}, "einzel", "150 €", "120 €", "60 Min."],
      ["standard tariff without reduced price", { profile_preis_std: 175, profile_preis_ermaessigt: 0 }, "einzel", "175 €", null, "60 Min."],
      ["couple coaching with nonstandard duration", { paarcoaching_preis: 280, paarcoaching_dauer_min: 75 }, "paar", "280 €", null, "75 Min."],
    ])("sends %s in the first mail and preserves the flow", async (_label, profile, coachingType, price, reduced, duration) => {
      const { response, clientMail, writes, reads } = await runMode(mode, { profile, coachingType });
      expect(response.status).toBe(200);
      expect(clientMail).toMatchObject({
        from: "Poise <noreply@mypoise.de>",
        to: CLIENT_EMAIL,
        subject: mode === "booking" ? "Dein Erstgespräch bei Poise ist bestätigt 🤍" : "Deine Anfrage bei Poise 🤍",
      });
      expect(clientMail.html).toContain("kostenlosen Erstgespräch von 30 Minuten im Video-Call");
      expect(clientMail.html).toContain("Danach entscheiden beide Seiten frei");
      expect(clientMail.html).toContain("Weitere Sitzungen sind kostenpflichtig.");
      expect(clientMail.html).toContain(`Eine Sitzung (${duration} Video-Call)`);
      expect(clientMail.html).toContain(price);
      expect(clientMail.html).toContain(SELF_PAYMENT_NOTICE);
      expect(clientMail.html).not.toContain("999");
      if (reduced) expect(clientMail.html).toContain(`Für Studierende und Auszubildende beträgt der Preis ${reduced}.`);
      else expect(clientMail.html).not.toContain("Studierende");
      const formCoach = mergeFormTeamMembers(mocks.team, [toFormTeamMember({ id: `${mode}-coach`, ...profile })])
        .find((coach) => coach.id === `${mode}-coach`);
      expect(clientMail.html).toContain(`kostet bei ${formCoach.name} `);
      expect(reads.find((read) => read.fields.includes("profile_preis_std")).filters).toContainEqual(["id", `${mode}-coach`]);
      expect(mocks.send).toHaveBeenCalledTimes(2);
      const coachMail = mocks.send.mock.calls.map(([mail]) => mail).find((mail) => mail.to === "coach@example.invalid");
      expect(coachMail.html).not.toContain(SELF_PAYMENT_NOTICE);
      expect(writes.filter((write) => write.table === "anfragen")[0].payload.status)
        .toBe(mode === "booking" ? "termin_bestaetigt" : "neu");
      expect(writes.some((write) => write.table === "sessions")).toBe(false);
      if (mode === "booking") {
        expect(clientMail.html).toContain("10:00 bis 10:30");
        expect(writes.find((write) => write.table === "blocked_slots").payload.end_at).toBe(END);
        expect(clientMail.html).toContain("https://video.example.invalid/test");
        expect(mocks.events.insert).toHaveBeenCalledTimes(1);
      } else {
        expect(clientMail.html).toContain("passenden Terminvorschlägen");
        expect(clientMail.html).toContain("Link zur Auswahl deines Wunschtermins");
        expect(mocks.events.insert).not.toHaveBeenCalled();
      }
    });

    it("does not trust prices or a coaching type supplied to the booking endpoint", async () => {
      const { response, clientMail } = await runMode(mode, {
        profile: { profile_preis_std: 180 },
        body: { preis_std: 1, honorar_klient: 1, ...(mode === "booking" ? { coaching_typ: "paar" } : {}) },
      });
      expect(response.status).toBe(200);
      expect(clientMail.html).toContain("180 €");
      expect(clientMail.html).toContain("60 Min.");
      expect(clientMail.html).not.toContain(" 1 €");
    });

    it("omits a genuinely absent reduced price", async () => {
      const { response, clientMail } = await runMode(mode, {
        coachId: "missing-coach",
        profile: { profile_preis_std: 160 },
      });
      expect(response.status).toBe(200);
      expect(clientMail.html).toContain("160 €");
      expect(clientMail.html).not.toContain("Studierende");
    });

    it.each([
      ["missing standard tariff", {}, "einzel"],
      ["zero standard tariff", { profile_preis_std: 0 }, "einzel"],
      ["negative standard tariff", { profile_preis_std: -1 }, "einzel"],
      ["missing couple tariff", { paarcoaching_dauer_min: 90 }, "paar"],
      ["missing couple duration", { paarcoaching_preis: 240 }, "paar"],
      ["invalid couple duration", { paarcoaching_preis: 240, paarcoaching_dauer_min: "invalid" }, "paar"],
    ])("stops before writes or sending on %s", async (_label, profile, coachingType) => {
      const { response, writes } = await runMode(mode, { coachId: "missing-coach", profile, coachingType });
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: "PUBLISHED_COACH_PRICE_MISSING" });
      expect(writes).toEqual([]);
      expect(mocks.send).not.toHaveBeenCalled();
      expect(mocks.events.insert).not.toHaveBeenCalled();
      expect(mocks.ensureConversation).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith("INITIAL MAIL PRICING ERROR:", { code: "PUBLISHED_COACH_PRICE_MISSING" });
    });

    it("fails explicitly on profile read errors instead of using a stale static rate", async () => {
      const { response, writes } = await runMode(mode, { profileError: { code: "TEST_DB_ERROR" } });
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: "PUBLISHED_COACH_PRICES_LOAD_FAILED" });
      expect(writes).toEqual([]);
      expect(mocks.send).not.toHaveBeenCalled();
    });

    it("retains the form's static fallback when no profile override exists", async () => {
      const { response, clientMail } = await runMode(mode, { profile: null });
      expect(response.status).toBe(200);
      expect(clientMail.html).toContain("150 €");
    });
  });

  it("preserves booking then request mails and the separate status inconsistency", async () => {
    await runMode("booking");
    const { writes, response } = await runMode("proposal", { coachId: "booking-coach", body: { terminISO: START } });
    expect(response.status).toBe(200);
    const clientMails = mocks.send.mock.calls.map(([mail]) => mail).filter((mail) => mail.to === CLIENT_EMAIL);
    expect(clientMails.map((mail) => mail.subject)).toEqual([
      "Dein Erstgespräch bei Poise ist bestätigt 🤍",
      "Deine Anfrage bei Poise 🤍",
    ]);
    expect(clientMails[0].html).toContain(SELF_PAYMENT_NOTICE);
    expect(clientMails[1].html).toContain(SELF_PAYMENT_NOTICE);
    expect(clientMails[1].html).toContain("Folgender Termin wurde für dich vorgemerkt:");
    expect(writes[0].payload.status).toBe("neu");
  });

  it("includes costs even when the form's dynamic proposal mode differs from the static booking template selector", async () => {
    const { response, clientMail } = await runMode("proposal", {
      coachId: "booking-coach",
      profile: { profile_calendar_mode: "proposal", profile_preis_std: 185 },
    });
    expect(response.status).toBe(200);
    expect(clientMail.subject).toBe("Deine Anfrage bei Poise 🤍");
    expect(clientMail.html).toContain("185 €");
    expect(clientMail.html).toContain(SELF_PAYMENT_NOTICE);
    expect(mocks.events.insert).not.toHaveBeenCalled();
  });

  it("leaves follow-up session prices, mail and booking unchanged", async () => {
    const state = buildSupabase({ coachId: "booking-coach", profileError: { code: "TEST_DB_ERROR" } });
    mocks.sb = state.sb;
    const response = await book(request({ token: "synthetic-booking-token", start: START, bookingType: "session", durationMin: 60 }));
    expect(response.status).toBe(200);
    const mail = mocks.send.mock.calls.map(([value]) => value).find((value) => value.to === CLIENT_EMAIL);
    expect(mail.subject).toBe("Dein Termin bei Poise ist bestätigt 🤍");
    expect(mail.html).not.toContain(SELF_PAYMENT_NOTICE);
    expect(state.writes.find((write) => write.table === "sessions").payload.price).toBe(999);
    expect(state.reads.some((read) => read.fields.includes("profile_preis_std"))).toBe(false);
  });
});
