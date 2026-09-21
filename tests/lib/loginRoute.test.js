import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.hoisted(() => vi.fn(async () => ({ error: null })));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signInWithOtp,
    },
  }),
}));

import { POST } from "../../app/api/login/route.js";

function request(body) {
  return new Request("https://app.example.invalid/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("login route magic link", () => {
  beforeEach(() => {
    signInWithOtp.mockClear();
  });

  it("keeps working for an existing user email", async () => {
    const response = await POST(request({ email: "coaching@anjatenge.de" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("calls signInWithOtp with shouldCreateUser: false", async () => {
    await POST(request({ email: "coaching@anjatenge.de" }));

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "coaching@anjatenge.de",
      options: {
        emailRedirectTo: "https://app.mypoise.de/auth/callback",
        shouldCreateUser: false,
      },
    });
  });

  it("preserves emailRedirectTo alongside shouldCreateUser: false", async () => {
    await POST(request({ email: "unknown@example.invalid" }));

    const options = signInWithOtp.mock.calls[0][0].options;
    expect(options.emailRedirectTo).toBe("https://app.mypoise.de/auth/callback");
    expect(options.shouldCreateUser).toBe(false);
  });

  it("does not leak whether an email is registered on failure", async () => {
    signInWithOtp.mockResolvedValueOnce({
      error: { message: "Signups not allowed for otp", code: "otp_disabled" },
    });

    const response = await POST(request({ email: "coachibg@anjatenge.de" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "SEND_FAILED", detail: "INTERNAL_ERROR" });
  });
});
