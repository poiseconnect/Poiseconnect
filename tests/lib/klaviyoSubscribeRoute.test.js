import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { POST } from "../../app/api/klaviyo/subscribe/route.js";

describe("disabled Klaviyo signup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    JSON.stringify({ email: "test@example.invalid", consent: true }),
    "not-json",
  ])("returns 410 without reading or forwarding the request", async (body) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const request = new Request("https://app.example.invalid/api/klaviyo/subscribe", {
      method: "POST",
      body,
    });

    const response = await POST(request);

    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: false, error: "NEWSLETTER_SIGNUP_DISABLED" });
    expect(request.bodyUsed).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("removes the newsletter checkbox and signup call from the intake", () => {
    const source = readFileSync("app/page-client.jsx", "utf8");

    expect(source).not.toContain("newsletter_consent");
    expect(source).not.toContain("/api/klaviyo/subscribe");
    expect(source).toContain('fetch("/api/form-submit"');
    expect(source).toContain("intakeConsentToken: healthDataConsentToken");
  });
});
