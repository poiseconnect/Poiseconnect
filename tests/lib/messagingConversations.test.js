import { describe, expect, it, vi } from "vitest";
import {
  closeConversation,
  ensureOpenConversation,
} from "../../app/lib/messaging/conversations.js";

function createSupabaseStub(result) {
  return {
    rpc: vi.fn().mockResolvedValue(result),
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
    expect(supabase.rpc).toHaveBeenCalledWith(
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