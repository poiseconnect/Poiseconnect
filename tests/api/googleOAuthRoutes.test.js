import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "auth-user-1" },
  member: { id: "coach-1", role: "therapist", active: true },
  memberError: null,
  upsertError: null,
  upserts: [],
  generatedAuthOptions: null,
  getToken: vi.fn(),
  supabase: null,
}));

vi.mock("../../app/api/_lib/server.js", () => ({
  getUserFromBearer: async () => ({ user: state.user, error: null }),
  supabaseAdmin: () => state.supabase,
  oauthClient: () => ({
    generateAuthUrl: (options) => {
      state.generatedAuthOptions = options;
      return "https://accounts.google.example.invalid/oauth";
    },
    getToken: state.getToken,
  }),
  json: (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
}));

import { GET as callback } from "../../app/api/google/callback/route.js";
import { GET as start } from "../../app/api/google/start/route.js";
import {
  createGoogleOAuthState,
  verifyGoogleOAuthState,
} from "../../app/api/_lib/googleOAuthState.js";

const stateSecret = "synthetic-google-client-secret";

function createSupabase() {
  return {
    from(table) {
      const filters = [];
      const query = {
        select() {
          return query;
        },
        eq(column, value) {
          filters.push([column, value]);
          return query;
        },
        single: async () => ({
          data: state.member,
          error: state.memberError,
        }),
        maybeSingle: async () => ({
          data: state.member,
          error: state.memberError,
        }),
        upsert(payload, options) {
          state.upserts.push({ table, payload, options });
          return Promise.resolve({ error: state.upsertError });
        },
      };
      return query;
    },
  };
}

function callbackRequest({ code = "synthetic-auth-code", stateValue, cookieValue }) {
  const params = new URLSearchParams();
  if (code) params.set("code", code);
  if (stateValue) params.set("state", stateValue);
  return new Request(`https://app.example.invalid/api/google/callback?${params}`, {
    headers: cookieValue
      ? { cookie: `google_oauth_state=${cookieValue}` }
      : {},
  });
}

function readSetCookieValue(setCookie) {
  return setCookie.split(";")[0].slice("google_oauth_state=".length);
}

describe("Google OAuth state validation", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_CLIENT_SECRET", stateSecret);
    state.user = { id: "auth-user-1" };
    state.member = { id: "coach-1", role: "therapist", active: true };
    state.memberError = null;
    state.upsertError = null;
    state.upserts = [];
    state.generatedAuthOptions = null;
    state.getToken = vi.fn().mockResolvedValue({
      tokens: {
        access_token: "synthetic-access-token",
        refresh_token: "synthetic-refresh-token",
        scope: "https://www.googleapis.com/auth/calendar",
      },
    });
    state.supabase = createSupabase();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects expired or tampered state cookies", () => {
    const flowState = createGoogleOAuthState("coach-1", stateSecret, 1_000);

    expect(
      verifyGoogleOAuthState(
        flowState.cookieValue,
        flowState.state,
        stateSecret,
        1_000 + flowState.maxAge * 1_000
      )
    ).toBeNull();
    expect(
      verifyGoogleOAuthState(
        `${flowState.cookieValue.slice(0, -1)}x`,
        flowState.state,
        stateSecret,
        1_000
      )
    ).toBeNull();
  });

  it("creates a short-lived, HttpOnly state cookie bound to the authenticated coach", async () => {
    const response = await start(new Request("https://app.example.invalid/api/google/start", {
      headers: { authorization: "Bearer synthetic-user-token" },
    }));
    const body = await response.json();
    const setCookie = response.headers.get("set-cookie");

    expect(response.status).toBe(200);
    expect(body.url).toBe("https://accounts.google.example.invalid/oauth");
    expect(state.generatedAuthOptions.state).toBeTruthy();
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Max-Age=300");
    expect(state.generatedAuthOptions.state).not.toBe(state.member.id);

    const cookieValue = readSetCookieValue(setCookie);
    const result = await callback(callbackRequest({
      stateValue: state.generatedAuthOptions.state,
      cookieValue,
    }));

    expect(result.status).toBe(302);
    expect(result.headers.get("location")).toBe("/dashboard?google=connected");
    expect(result.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(state.getToken).toHaveBeenCalledWith("synthetic-auth-code");
    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0].payload.therapist_id).toBe("coach-1");
    expect(await result.text()).toBe("");
  });

  it("rejects a callback without the browser-bound state cookie", async () => {
    const response = await callback(callbackRequest({
      stateValue: "attacker-controlled-state",
    }));

    expect(response.status).toBe(400);
    expect(state.getToken).not.toHaveBeenCalled();
    expect(state.upserts).toHaveLength(0);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("rejects a state value that does not match its signed cookie", async () => {
    const startResponse = await start(new Request("https://app.example.invalid/api/google/start", {
      headers: { authorization: "Bearer synthetic-user-token" },
    }));
    const cookieValue = readSetCookieValue(startResponse.headers.get("set-cookie"));

    const response = await callback(callbackRequest({
      stateValue: "different-state",
      cookieValue,
    }));

    expect(response.status).toBe(400);
    expect(state.getToken).not.toHaveBeenCalled();
    expect(state.upserts).toHaveLength(0);
  });

  it("rejects an inactive or non-therapist member before token exchange", async () => {
    const startResponse = await start(new Request("https://app.example.invalid/api/google/start", {
      headers: { authorization: "Bearer synthetic-user-token" },
    }));
    const stateValue = state.generatedAuthOptions.state;
    const cookieValue = readSetCookieValue(startResponse.headers.get("set-cookie"));
    state.member.active = false;

    const response = await callback(callbackRequest({ stateValue, cookieValue }));

    expect(response.status).toBe(403);
    expect(state.getToken).not.toHaveBeenCalled();
    expect(state.upserts).toHaveLength(0);
  });

  it("rejects OAuth start without an authenticated user", async () => {
    state.user = null;

    const response = await start(new Request("https://app.example.invalid/api/google/start"));

    expect(response.status).toBe(401);
    expect(state.generatedAuthOptions).toBeNull();
  });
});
