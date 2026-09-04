import { beforeEach, describe, expect, it, vi } from "vitest";

const queryResult = vi.hoisted(() => ({ value: null }));
const sendClientMessage = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => queryResult.value,
        }),
      }),
    }),
  }),
}));

vi.mock("resend", () => ({
  Resend: class Resend {},
}));

vi.mock("../../app/lib/messaging/outbound.js", () => ({
  sendClientMessage,
}));

import { POST } from "../../app/api/proposals/message/route.js";

const validToken = "proposal-token";
const validIdempotencyKey = "58d9e08c-f95e-4d94-9877-a97b43256e48";

function request(body, idempotencyKey = validIdempotencyKey) {
  return new Request("https://app.example.invalid/api/proposals/message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
}

describe("proposal message route", () => {
  beforeEach(() => {
    queryResult.value = { data: { id: "request-1" }, error: null };
    sendClientMessage.mockReset();
  });

  it("resolves the request solely from the proposal token and delegates to the existing messaging helper", async () => {
    sendClientMessage.mockResolvedValue({
      ok: true,
      message: { id: "message-1", delivery_status: "forwarded" },
    });

    const response = await POST(request({
      token: validToken,
      text: "Nächste Woche passt besser.",
      therapistId: "attacker-controlled",
      conversationId: "attacker-controlled",
      recipient: "attacker-controlled",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message: { id: "message-1", delivery_status: "forwarded" },
      duplicate: false,
    });
    expect(sendClientMessage).toHaveBeenCalledWith(expect.objectContaining({
      anfrageId: "request-1",
      subject: "Rückmeldung zu Terminvorschlägen",
      text: "Nächste Woche passt besser.",
      clientRequestId: validIdempotencyKey,
    }));
    expect(sendClientMessage.mock.calls[0][0]).not.toHaveProperty("therapistId");
    expect(sendClientMessage.mock.calls[0][0]).not.toHaveProperty("conversationId");
    expect(sendClientMessage.mock.calls[0][0]).not.toHaveProperty("recipient");
  });

  it("rejects an invalid proposal token before sending", async () => {
    queryResult.value = { data: null, error: { code: "PGRST116" } };

    const response = await POST(request({ token: validToken, text: "Nachricht" }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_TOKEN" });
    expect(sendClientMessage).not.toHaveBeenCalled();
  });

  it("fails closed when the existing messaging helper rejects the conversation", async () => {
    sendClientMessage.mockResolvedValue({ error: "CONVERSATION_NOT_FOUND" });

    const response = await POST(request({ token: validToken, text: "Nachricht" }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "CONVERSATION_NOT_FOUND" });
  });
});