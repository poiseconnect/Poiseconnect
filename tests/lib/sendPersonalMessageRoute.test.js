import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserFromBearer = vi.hoisted(() => vi.fn());
const supabaseAdmin = vi.hoisted(() => vi.fn());
const sendCoachMessage = vi.hoisted(() => vi.fn());

vi.mock("../../app/api/_lib/server.js", () => ({
  getUserFromBearer,
  supabaseAdmin,
  json: (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  }),
}));

vi.mock("../../app/lib/messaging/outbound.js", () => ({
  sendCoachMessage,
}));

import { POST } from "../../app/api/send-personal-message/route.js";

describe("personal message route", () => {
  beforeEach(() => {
    getUserFromBearer.mockResolvedValue({ user: { id: "synthetic-user" } });
    sendCoachMessage.mockReset();
  });

  it("denies a former coach before reading the conversation or dispatching content", async () => {
    const sb = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          allowed: false,
          reason: "ASSIGNMENT_NOT_CURRENT",
          requestId: "request-1",
          conversationId: null,
          careVersion: 1,
        },
        error: null,
      }),
      from: vi.fn((table) => {
        if (table !== "team_members") {
          throw new Error(`Unexpected pre-authorization table read: ${table}`);
        }
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          single: vi.fn().mockResolvedValue({
            data: { id: "coach-1", role: "therapist", active: true },
            error: null,
          }),
        };
        return query;
      }),
    };
    supabaseAdmin.mockReturnValue(sb);

    const response = await POST(new Request("https://app.example.invalid/api/send-personal-message", {
      method: "POST",
      headers: { Authorization: "Bearer synthetic-token", "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: "request-1",
        subject: "Synthetic subject",
        message: "Synthetic content",
      }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "MESSAGING_ACCESS_DENIED" });
    expect(sb.rpc).toHaveBeenCalledWith("privacy_messaging_context", expect.objectContaining({
      p_request_id: "request-1",
      p_coach_id: "coach-1",
    }));
    expect(sb.from.mock.calls.map(([table]) => table)).toEqual(["team_members"]);
    expect(sendCoachMessage).not.toHaveBeenCalled();
  });
});
