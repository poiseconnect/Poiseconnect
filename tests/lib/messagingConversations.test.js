import { describe, expect, it, vi } from "vitest";
import {
  closeConversation,
  ensureOpenConversation,
} from "../../app/lib/messaging/conversations.js";

function createSupabaseStub(result, access = {
  allowed: true,
  requestId: "request-1",
  conversationId: null,
  careVersion: 0,
}) {
  return {
    rpc: vi.fn((name) => {
      if (name === "privacy_messaging_context") {
        return Promise.resolve({ data: access, error: null });
      }
      return Promise.resolve(result);
    }),
  };
}

describe("messaging conversation lifecycle", () => {
  it("stellt eine Conversation mit Anfrage und Coach sicher", async () => {
    const supabase = createSupabaseStub({ data: { id: "conversation-1" }, error: null });
    const previousDomain = process.env.RESEND_REPLY_DOMAIN;
    process.env.RESEND_REPLY_DOMAIN = "reply.mypoise.de";

    const conversation = await ensureOpenConversation({
      supabase,
      anfrageId: "request-1",
      therapistId: "coach-1",
    });

    expect(conversation).toEqual({ id: "conversation-1" });
    expect(supabase.rpc).toHaveBeenLastCalledWith(
      "ensure_open_request_conversation",
      expect.objectContaining({
        p_anfrage_id: "request-1",
        p_therapist_id: "coach-1",
        p_reply_alias: expect.stringMatching(/^r-/),
        p_reply_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    );

    process.env.RESEND_REPLY_DOMAIN = previousDomain;
  });

  it("returns a pending conversation when a valid request has no messaging grant", async () => {
    const supabase = createSupabaseStub(
      { data: { id: "unused" }, error: null },
      {
        allowed: false,
        reason: "MESSAGING_CONTENT_PAUSED",
        requestId: "request-1",
        conversationId: null,
        careVersion: 0,
      }
    );

    await expect(ensureOpenConversation({
      supabase,
      anfrageId: "request-1",
      therapistId: "coach-1",
    })).resolves.toEqual({ id: null, status: "pending", reply_alias: null });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("privacy_messaging_context", expect.objectContaining({
      p_request_id: "request-1",
      p_coach_id: "coach-1",
    }));
  });

  it("schließt und widerruft die offene Conversation über die RPC", async () => {
    const supabase = createSupabaseStub({ data: null, error: null });

    await closeConversation({
      supabase,
      anfrageId: "request-1",
      reason: "beendet",
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "close_open_request_conversation",
      { p_anfrage_id: "request-1", p_reason: "beendet" }
    );
  });
});