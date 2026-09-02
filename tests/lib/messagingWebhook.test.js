import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("../../app/lib/messaging/inbound");
  vi.doUnmock("../../app/api/_lib/server");
  vi.resetModules();
});

describe("Resend inbound webhook", () => {
  it("lehnt fehlende oder ungültige Svix-Signaturen ohne Verarbeitung ab", async () => {
    const { POST } = await import("../../app/api/webhooks/resend/route.js");
    const response = await POST(new Request("https://app.example.invalid/api/webhooks/resend", {
      method: "POST",
      body: JSON.stringify({ id: "event-1", type: "email.received" }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_WEBHOOK_SIGNATURE" });
  });

  it("gibt EVENT_ID_MISSING nicht als erfolgreichen Webhook zurück", async () => {
    vi.doMock("../../app/lib/messaging/inbound", () => ({
      verifyResendWebhook: vi.fn(() => ({ type: "email.received", data: { email_id: "email-1" } })),
      processInboundResendEvent: vi.fn(() => Promise.resolve({ error: "EVENT_ID_MISSING" })),
    }));
    vi.doMock("../../app/api/_lib/server", () => ({
      json: (data, status = 200) => new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
      supabaseAdmin: vi.fn(() => ({})),
    }));

    const { POST } = await import("../../app/api/webhooks/resend/route.js");
    const response = await POST(new Request("https://app.example.invalid/api/webhooks/resend", {
      method: "POST",
      headers: { "svix-id": "svix-event-1" },
      body: JSON.stringify({ type: "email.received", data: { email_id: "email-1" } }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "EVENT_ID_MISSING" });
  });
});