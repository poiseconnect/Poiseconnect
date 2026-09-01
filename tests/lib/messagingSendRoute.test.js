import { describe, expect, it } from "vitest";
import { POST } from "../../app/api/messages/send/route.js";

describe("outbound messaging route", () => {
  it("lehnt unauthentifizierte Requests vor Datenbank- und Mailzugriff ab", async () => {
    const response = await POST(new Request("https://app.example.invalid/api/messages/send", {
      method: "POST",
      body: JSON.stringify({
        conversationId: "conversation-1",
        subject: "Betreff",
        text: "Text",
      }),
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "NO_TOKEN" });
  });
});