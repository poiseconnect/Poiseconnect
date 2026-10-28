import { describe, expect, it, vi } from "vitest";
import {
  processInboundResendEvent,
  fetchReceivedEmail,
} from "../../app/lib/messaging/inbound.js";
import {
  sendClientMessage,
  sendCoachMessage,
} from "../../app/lib/messaging/outbound.js";
import { hashReplyToken } from "../../app/lib/messaging/aliases.js";

process.env.RESEND_REPLY_DOMAIN = "reply.mypoise.de";

const replyToken = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const replyAlias = `r-${replyToken}@reply.mypoise.de`;
const accessContext = {
  allowed: true,
  requestId: "request-1",
  conversationId: "conversation-1",
  careVersion: 1,
};

function createSupabase({ access = accessContext, accessError = null, duplicate = false } = {}) {
  const updates = [];
  const insertResult = duplicate
    ? { data: null, error: { code: "23505" } }
    : { data: { id: "ledger-1" }, error: null };
  const supabase = {
    rpc: vi.fn().mockResolvedValue({ data: access, error: accessError }),
    from: vi.fn((table) => {
      if (table !== "request_message_events") {
        throw new Error(`Sensitive table access attempted: ${table}`);
      }
      return {
        insert: vi.fn(() => ({
          select: () => ({ single: async () => insertResult }),
        })),
        update: vi.fn((payload) => {
          updates.push(payload);
          return { eq: async () => ({ error: null }) };
        }),
      };
    }),
  };
  return { supabase, updates };
}

describe("messaging privacy gates", () => {
  it("pauses coach and client sends after authorization and before any data/provider access", async () => {
    const coach = createSupabase();
    const client = createSupabase({
      access: { ...accessContext, conversationId: null },
    });
    const provider = { emails: { send: vi.fn() } };

    await expect(sendCoachMessage({
      supabase: coach.supabase,
      resendClient: provider,
      coachId: "coach-1",
      conversationId: "conversation-1",
      subject: "Synthetic subject",
      text: "Synthetic body",
    })).resolves.toEqual({ error: "MESSAGING_CONTENT_PAUSED" });

    await expect(sendClientMessage({
      supabase: client.supabase,
      resendClient: provider,
      anfrageId: "request-1",
      subject: "Synthetic subject",
      text: "Synthetic response",
    })).resolves.toEqual({ error: "MESSAGING_CONTENT_PAUSED" });

    expect(coach.supabase.from).not.toHaveBeenCalled();
    expect(client.supabase.from).not.toHaveBeenCalled();
    expect(provider.emails.send).not.toHaveBeenCalled();
  });

  it("denies a former coach without querying conversation/message content", async () => {
    const { supabase } = createSupabase({
      access: {
        ...accessContext,
        allowed: false,
        reason: "ASSIGNMENT_NOT_CURRENT",
      },
    });

    await expect(sendCoachMessage({
      supabase,
      coachId: "former-coach",
      conversationId: "conversation-1",
      subject: "Synthetic subject",
      text: "Synthetic body",
    })).resolves.toEqual({ error: "MESSAGING_ACCESS_DENIED" });

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("authorizes inbound alias metadata but never retrieves a provider body or forwards content", async () => {
    const { supabase, updates } = createSupabase();
    const fetchImpl = vi.fn();
    const provider = { emails: { send: vi.fn() } };
    const event = {
      id: "synthetic-event-1",
      type: "email.received",
      data: { email_id: "synthetic-email-1", to: [replyAlias] },
    };

    await expect(processInboundResendEvent({
      supabase,
      event,
      fetchImpl,
      resendClient: provider,
    })).resolves.toEqual({ error: "MESSAGING_CONTENT_PAUSED" });

    expect(supabase.rpc).toHaveBeenCalledWith("privacy_messaging_context", {
      p_request_id: null,
      p_conversation_id: null,
      p_reply_hash: hashReplyToken(replyToken),
      p_coach_id: null,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(provider.emails.send).not.toHaveBeenCalled();
    expect(updates).toContainEqual(expect.objectContaining({
      processing_error: "MESSAGING_CONTENT_PAUSED",
    }));
  });

  it("does not read stored message bodies during duplicate-event retries", async () => {
    const { supabase } = createSupabase({ duplicate: true });
    const fetchImpl = vi.fn();
    const provider = { emails: { send: vi.fn() } };

    await expect(processInboundResendEvent({
      supabase,
      event: {
        id: "synthetic-event-2",
        type: "email.received",
        data: { email_id: "synthetic-email-2", to: [replyAlias] },
      },
      fetchImpl,
      resendClient: provider,
    })).resolves.toEqual({ error: "MESSAGING_CONTENT_PAUSED" });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(provider.emails.send).not.toHaveBeenCalled();
  });

  it("requires a central authorization context before direct provider body retrieval", async () => {
    const fetchImpl = vi.fn();

    await expect(fetchReceivedEmail("synthetic-email-3", fetchImpl))
      .rejects.toThrow("MESSAGING_ACCESS_UNAVAILABLE");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
