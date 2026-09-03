import { afterEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "svix";
import { verifyResendWebhook } from "../../app/lib/messaging/inbound.js";

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

  it("gibt bei gültiger Svix-Signatur das echte geparste Event zurück", () => {
    const secret = "whsec_dGVzdC1zZWNyZXQtZm9yLXVuaXQtdGVzdHM=";
    const rawBody = JSON.stringify({ type: "email.received", data: { email_id: "email-test-1" } });
    const svixId = "msg_test_1";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const signature = new Webhook(secret).sign(svixId, new Date(Number(svixTimestamp) * 1000), rawBody);

    const result = verifyResendWebhook({
      rawBody,
      headers: new Headers({
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": signature,
      }),
      secret,
    });

    expect(result.type).toBe("email.received");
    expect(result.data.email_id).toBe("email-test-1");
  });
});