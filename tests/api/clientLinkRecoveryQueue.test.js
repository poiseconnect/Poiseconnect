import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), fetch: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));

import { GET as processRecoveryQueue } from "../../app/api/cron/client-link-recovery/route.js";
import { encryptRecoverySecret } from "../../app/lib/clientLinkRecovery.js";

const secret = "a".repeat(64);
const job = {
  job_id: 7,
  claim_token: "synthetic-claim-token",
  email: "stored@example.invalid",
  encrypted_secret: "",
};

function request(authorization = "Bearer synthetic-cron-secret") {
  return new Request("https://app.example.invalid/api/cron/client-link-recovery", {
    headers: { authorization },
  });
}

describe("client-link recovery queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "synthetic-cron-secret");
    vi.stubEnv("RESEND_API_KEY", "synthetic-resend-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-service-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.invalid");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.invalid");
    mocks.fetch.mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", mocks.fetch);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requires a configured cron secret and rejects unauthenticated callers", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await processRecoveryQueue(request())).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "synthetic-cron-secret");
    expect((await processRecoveryQueue(request("Bearer wrong"))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("sends only the server-resolved recipient with a stable provider idempotency key", async () => {
    const queuedJob = { ...job, encrypted_secret: encryptRecoverySecret(secret) };
    mocks.rpc.mockImplementation(async (name) => {
      if (name === "claim_client_link_recovery_queue") return { data: [queuedJob], error: null };
      if (name === "process_client_link_recovery_queue") {
        return { data: [{ recipient: "stored@example.invalid" }], error: null };
      }
      if (name === "finish_client_link_recovery_queue") return { data: true, error: null };
      throw new Error(`unexpected RPC ${name}`);
    });

    const response = await processRecoveryQueue(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, sent: 1, noMatch: 0, retrying: 0 });
    expect(mocks.fetch).toHaveBeenCalledOnce();
    const [url, options] = mocks.fetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers.Authorization).toBe("Bearer synthetic-resend-key");
    expect(options.headers["Idempotency-Key"]).toBe("client-link-recovery-7");
    const email = JSON.parse(options.body);
    expect(email.to).toBe("stored@example.invalid");
    expect(email.text).toContain(`/recover-link#${secret}`);
    expect(email.text).not.toContain("synthetic-booking-token");
    expect(mocks.rpc).toHaveBeenCalledWith("finish_client_link_recovery_queue", {
      p_job_id: 7,
      p_claim_token: "synthetic-claim-token",
      p_outcome: "sent",
    });
  });

  it("completes unmatched requests without contacting the mail provider", async () => {
    mocks.rpc.mockImplementation(async (name) => {
      if (name === "claim_client_link_recovery_queue") return { data: [job], error: null };
      if (name === "process_client_link_recovery_queue") return { data: [], error: null };
      if (name === "finish_client_link_recovery_queue") return { data: true, error: null };
      throw new Error(`unexpected RPC ${name}`);
    });

    const response = await processRecoveryQueue(request());
    expect(await response.json()).toEqual({ ok: true, sent: 0, noMatch: 1, retrying: 0 });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("finish_client_link_recovery_queue", {
      p_job_id: 7,
      p_claim_token: "synthetic-claim-token",
      p_outcome: "no_match",
    });
  });

  it("requeues provider failures for retry without disclosing the failure", async () => {
    const queuedJob = { ...job, encrypted_secret: encryptRecoverySecret(secret) };
    mocks.rpc.mockImplementation(async (name) => {
      if (name === "claim_client_link_recovery_queue") return { data: [queuedJob], error: null };
      if (name === "process_client_link_recovery_queue") {
        return { data: [{ recipient: "stored@example.invalid" }], error: null };
      }
      if (name === "retry_client_link_recovery_queue") return { data: true, error: null };
      throw new Error(`unexpected RPC ${name}`);
    });
    mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 503 }));

    const response = await processRecoveryQueue(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, sent: 0, noMatch: 0, retrying: 1 });
    expect(mocks.rpc).toHaveBeenCalledWith("retry_client_link_recovery_queue", {
      p_job_id: 7,
      p_claim_token: "synthetic-claim-token",
    });
    expect(JSON.stringify(body)).not.toContain("stored@example.invalid");
  });
});
