import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserFromBearer = vi.hoisted(() => vi.fn());
const supabaseAdmin = vi.hoisted(() => vi.fn());
const sendCoachMessage = vi.hoisted(() => vi.fn());
const resendConstructed = vi.hoisted(() => vi.fn());

vi.mock("../../app/api/_lib/server.js", () => ({
  getUserFromBearer,
  supabaseAdmin,
  json: (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  }),
}));

vi.mock("resend", () => ({
  Resend: class Resend {
    constructor() {
      resendConstructed();
    }
  },
}));

vi.mock("../../app/lib/messaging/outbound.js", () => ({
  sendCoachMessage,
}));

import { POST } from "../../app/api/messages/send/route.js";

function request() {
  return new Request("https://app.example.invalid/api/messages/send", {
    method: "POST",
    headers: {
      Authorization: "Bearer synthetic-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversationId: "conversation-1",
      subject: "Synthetic subject",
      text: "Synthetic message",
    }),
  });
}

describe("outbound messaging route", () => {
  beforeEach(() => {
    getUserFromBearer.mockReset();
    supabaseAdmin.mockReset();
    sendCoachMessage.mockReset();
    resendConstructed.mockReset();
  });

  it("rejects unauthenticated requests before database and mail access", async () => {
    const response = await POST(new Request("https://app.example.invalid/api/messages/send", {
      method: "POST",
      body: JSON.stringify({
        conversationId: "conversation-1",
        subject: "Synthetic subject",
        text: "Synthetic message",
      }),
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "NO_TOKEN" });
    expect(supabaseAdmin).not.toHaveBeenCalled();
    expect(resendConstructed).not.toHaveBeenCalled();
  });

  it("returns an explicit pause and never reports a successful dispatch", async () => {
    getUserFromBearer.mockResolvedValue({ user: { id: "synthetic-user" }, error: null });
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      single: vi.fn().mockResolvedValue({
        data: { id: "coach-1", role: "therapist", active: true },
        error: null,
      }),
    };
    supabaseAdmin.mockReturnValue({ from: vi.fn(() => query) });
    sendCoachMessage.mockResolvedValue({ error: "MESSAGING_CONTENT_PAUSED" });

    const response = await POST(request());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "MESSAGING_CONTENT_PAUSED" });
    expect(sendCoachMessage).toHaveBeenCalledWith(expect.objectContaining({
      coachId: "coach-1",
      conversationId: "conversation-1",
      subject: "Synthetic subject",
      text: "Synthetic message",
    }));
    expect(resendConstructed).not.toHaveBeenCalled();
  });
});
