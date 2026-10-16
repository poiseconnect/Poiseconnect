import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.send }; } }));

import { POST as requestRecovery } from "../../app/api/client-link-recovery/request/route.js";
import { POST as consumeRecovery } from "../../app/api/client-link-recovery/consume/route.js";
import { POST as legacyResolver } from "../../app/api/proposals/resolve-legacy-link/route.js";
import { recoveryHash, recoveryDestination } from "../../app/lib/clientLinkRecovery.js";

function request(body) {
  return new Request("https://untrusted.example.invalid/api/client-link-recovery/request", {
    method: "POST", headers: { "Content-Type": "application/json", "x-vercel-forwarded-for": "192.0.2.5" },
    body: JSON.stringify(body),
  });
}
function consume(secret) {
  const body = new FormData();
  body.set("secret", secret);
  return new Request("https://untrusted.example.invalid/api/client-link-recovery/consume", { method: "POST", body });
}
const input = { requestId: "synthetic-request", email: "test@example.invalid", purpose: "proposal" };
const grant = {
  request_id: "synthetic-request", booking_token: "synthetic-booking-token", purpose: "proposal", resume_step: 9,
};

describe("legacy client link recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-service-key");
    mocks.rpc.mockResolvedValue({ data: [{ recipient: "stored@example.invalid" }], error: null });
    mocks.send.mockResolvedValue({ data: { id: "synthetic-mail" }, error: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it("does not exchange an ID for a booking token", async () => {
    const response = await legacyResolver(request({ requestId: "synthetic-request" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "RECOVERY_REQUIRED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("sends a neutral, user-confirmed recovery link only to the server-stored recipient", async () => {
    const response = await requestRecovery(request({ ...input, redirect: "https://evil.invalid", to: "evil@example.invalid" }));
    expect(response.status).toBe(202);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.send).toHaveBeenCalledOnce();
    const mail = mocks.send.mock.calls[0][0];
    expect(mail.to).toBe("stored@example.invalid");
    expect(mail.subject).not.toMatch(/Termin|Coach|Anfrage|Therap/);
    expect(mail.text).not.toContain("synthetic-booking-token");
    expect(mail.text).not.toContain(input.requestId);
    const secret = mail.text.match(/https:\/\/app\.example\.invalid\/recover-link#([a-f0-9]{64})/)[1];
    expect(mocks.rpc).toHaveBeenCalledWith("issue_client_link_recovery", expect.objectContaining({
      p_email: input.email, p_secret_hash: recoveryHash(secret), p_purpose: "proposal",
    }));
    const responseText = await response.text();
    expect(responseText).not.toContain(secret);
    expect(responseText).not.toContain("stored@example.invalid");
    expect(responseText).not.toContain("token");
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(secret);
  });

  it.each([
    ["unknown or mismatched recipient", { data: [], error: null }],
    ["persistent rate limit", { data: [], error: null }],
    ["missing migration", { data: null, error: { code: "PGRST202" } }],
  ])("returns the same response for %s", async (_label, result) => {
    const successful = await requestRecovery(request(input));
    mocks.send.mockClear();
    mocks.rpc.mockResolvedValueOnce(result);
    const response = await requestRecovery(request(input));
    expect(response.status).toBe(successful.status);
    expect(await response.text()).toBe(await successful.text());
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not expose mail-provider failures", async () => {
    mocks.send.mockRejectedValueOnce(new Error("synthetic-provider-failure"));
    const response = await requestRecovery(request(input));
    expect(response.status).toBe(202);
    expect(await response.text()).not.toContain("failure");
    expect(console.error).toHaveBeenCalledWith("CLIENT_LINK_RECOVERY_UNAVAILABLE");
  });

  it.each(["https://evil.invalid", "", "appointment/../../dashboard"])("rejects unrecognized purpose %s without sending", async (purpose) => {
    const response = await requestRecovery(request({ ...input, purpose }));
    expect(response.status).toBe(202);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("supports timestamp legacy proposal links and ambiguous email-only links via the server resolver", async () => {
    await requestRecovery(request({ email: input.email, purpose: "proposal", legacyProposal: "2026-10-20T10:00:00.000Z" }));
    expect(mocks.rpc).toHaveBeenLastCalledWith("issue_client_link_recovery", expect.objectContaining({
      p_request_id: null, p_legacy_proposal: "2026-10-20T10:00:00.000Z",
    }));
    await requestRecovery(request({ email: input.email, purpose: "appointment" }));
    expect(mocks.rpc).toHaveBeenLastCalledWith("issue_client_link_recovery", expect.objectContaining({
      p_request_id: null, p_legacy_proposal: null, p_purpose: "appointment",
    }));
  });

  it("consumes a secret via POST and redirects only to the fixed purpose destination", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [grant], error: null });
    const response = await consumeRecovery(consume("a".repeat(64)));
    expect(mocks.rpc).toHaveBeenCalledWith("consume_client_link_recovery", { p_secret_hash: recoveryHash("a".repeat(64)) });
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("https://app.example.invalid/confirm-proposal?token=synthetic-booking-token");
    expect(await response.text()).toBe("");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it.each(["expired", "used", "changed recipient", "rotated token"])("offers recovery for %s grants without disclosing credentials", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [], error: null });
    const response = await consumeRecovery(consume("b".repeat(64)));
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("https://app.example.invalid/recover-link?invalid=1");
    expect(await response.text()).toBe("");
  });

  it("rejects malformed secrets without touching the database", async () => {
    await consumeRecovery(consume("not-a-secret"));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["proposal", "/confirm-proposal", null],
    ["coach-selection", "/", "8"],
    ["appointment", "/", "10"],
    ["draft", "/", "9"],
  ])("uses a fixed safe destination for %s", (purpose, pathname, resume) => {
    const url = new URL(recoveryDestination({ ...grant, purpose, redirect: "https://evil.invalid" }));
    expect(url.origin).toBe("https://app.example.invalid");
    expect(url.pathname).toBe(pathname);
    expect(url.searchParams.get("resume")).toBe(resume);
    expect(url.searchParams.get("token")).toBe(grant.booking_token);
    expect(url.searchParams.has("email")).toBe(false);
  });

  it("defines persistent atomic one-time and limiter guards in the unapplied migration", () => {
    const sql = readFileSync("supabase/migrations/20261016000000_client_link_recovery.sql", "utf8");
    expect(sql).toContain("for update of a");
    expect(sql).toContain("v_link.consumed_at is not null");
    expect(sql).toContain("v_link.expires_at <= now()");
    expect(sql).toContain("v_request.email is distinct from v_link.recipient");
    expect(sql).toContain("v_link.token_fingerprint");
    expect(sql).toContain("on conflict (bucket, key) do update");
    expect(sql).toContain("if v_count > 10 then return");
    expect(sql).toContain("if v_count > 3 then return");
    expect(sql).toContain("cardinality(v_candidates), 0) <> 1");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).not.toContain("security definer");
  });

  it("keeps the UI off the token-disclosing resolver and strips recovery fragments before confirmation", () => {
    const proposal = readFileSync("app/confirm-proposal/page-client.jsx", "utf8");
    const form = readFileSync("app/page-client.jsx", "utf8");
    const recovery = readFileSync("app/recover-link/page.jsx", "utf8");
    expect(proposal).toContain("ClientLinkRecovery");
    expect(proposal).toContain('searchParams.get("id")');
    expect(proposal).not.toContain("/api/proposals/resolve-legacy-link");
    expect(form).toContain("booking_token: bookingToken || null");
    expect(form).not.toContain('console.log("✅ LOADED EXISTING REQUEST"');
    expect(form).not.toContain("booking_token: json.booking_token,");
    expect(recovery).toContain("window.history.replaceState");
    expect(recovery).toContain('method="post"');
  });
});
