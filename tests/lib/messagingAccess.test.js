import { describe, expect, it, vi } from "vitest";
import {
  authorizeMessagingContext,
  getMessagingDispatchAvailability,
} from "../../app/lib/messaging/access.js";

function makeSupabase(data, error = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error }),
  };
}

const requestContext = {
  allowed: true,
  requestId: "request-1",
  conversationId: "conversation-1",
  careVersion: "2",
};

describe("messaging access", () => {
  it("uses the central RPC and strictly normalizes the authorized care context", async () => {
    const supabase = makeSupabase(requestContext);

    await expect(authorizeMessagingContext(supabase, {
      requestId: "request-1",
      conversationId: "conversation-1",
      coachId: "coach-1",
    })).resolves.toEqual({
      ok: true,
      context: { ...requestContext, careVersion: 2 },
    });

    expect(supabase.rpc).toHaveBeenCalledWith("privacy_messaging_context", {
      p_request_id: "request-1",
      p_conversation_id: "conversation-1",
      p_reply_hash: null,
      p_coach_id: "coach-1",
    });
  });

  it("fails closed when the RPC is unavailable or its result is malformed", async () => {
    await expect(authorizeMessagingContext(makeSupabase(null, { code: "RPC_MISSING" }), {
      requestId: "request-1",
    })).resolves.toEqual({ ok: false, error: "MESSAGING_ACCESS_UNAVAILABLE" });

    await expect(authorizeMessagingContext(makeSupabase({
      ...requestContext,
      careVersion: "not-a-version",
    }), {
      requestId: "request-1",
    })).resolves.toEqual({ ok: false, error: "MESSAGING_ACCESS_UNAVAILABLE" });
  });

  it("preserves explicit pause separately from an authorization denial", async () => {
    await expect(authorizeMessagingContext(makeSupabase({
      ...requestContext,
      allowed: false,
      reason: "MESSAGING_CONTENT_PAUSED",
    }), {
      requestId: "request-1",
    })).resolves.toEqual({ ok: false, error: "MESSAGING_CONTENT_PAUSED" });

    await expect(authorizeMessagingContext(makeSupabase({
      ...requestContext,
      allowed: false,
      reason: "ASSIGNMENT_NOT_CURRENT",
    }), {
      requestId: "request-1",
    })).resolves.toEqual({ ok: false, error: "MESSAGING_ACCESS_DENIED" });
  });

  it("maps the exact minimal denial payloads returned by the SQL RPC", async () => {
    await expect(authorizeMessagingContext(makeSupabase({
      allowed: false,
      reason: "MESSAGING_CONTENT_PAUSED",
    }), {
      requestId: "request-1",
    })).resolves.toEqual({ ok: false, error: "MESSAGING_CONTENT_PAUSED" });

    await expect(authorizeMessagingContext(makeSupabase({
      allowed: false,
    }), {
      requestId: "request-1",
    })).resolves.toEqual({ ok: false, error: "MESSAGING_ACCESS_DENIED" });
  });

  it("keeps dispatch disabled independent of access context", () => {
    expect(getMessagingDispatchAvailability()).toEqual({
      ok: false,
      error: "MESSAGING_CONTENT_PAUSED",
    });
  });

  it("rejects mismatched identifiers instead of trusting the RPC response", async () => {
    const supabase = makeSupabase({ ...requestContext, requestId: "another-request" });

    await expect(authorizeMessagingContext(supabase, {
      requestId: "request-1",
    })).resolves.toEqual({ ok: false, error: "MESSAGING_ACCESS_UNAVAILABLE" });
  });
});
