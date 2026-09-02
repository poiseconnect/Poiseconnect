import { describe, expect, it } from "vitest";
import { POST } from "../../app/api/webhooks/resend/route.js";

describe("Resend inbound webhook", () => {
  it("lehnt fehlende oder ungültige Svix-Signaturen ohne Verarbeitung ab", async () => {
    const response = await POST(new Request("https://app.example.invalid/api/webhooks/resend", {
      method: "POST",
      body: JSON.stringify({ id: "event-1", type: "email.received" }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_WEBHOOK_SIGNATURE" });
  });
});