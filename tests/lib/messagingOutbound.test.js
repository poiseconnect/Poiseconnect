import { describe, expect, it, vi } from "vitest";
import {
  createOutboundMail,
  sendCoachMessage,
} from "../../app/lib/messaging/outbound.js";

const conversation = {
  id: "conversation-1",
  anfrage_id: "request-1",
  therapist_id: "coach-a",
  status: "open",
  reply_alias: "r-safe-token@reply.mypoise.de",
  alias_revoked_at: null,
};

const request = {
  id: "request-1",
  email: "client@example.invalid",
  assigned_therapist_id: "coach-a",
};

function query(result, terminal = "single") {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return { ...chain, [terminal]: vi.fn().mockResolvedValue(result) };
}

function createSupabase({
  conversationResult = { data: conversation, error: null },
  requestResult = { data: request, error: null },
  insertResult = { data: { id: "message-1", delivery_status: "queued" }, error: null },
  sentResult = { data: { id: "provider-message-1" }, error: null },
  existingMessage = null,
} = {}) {
  const inserted = [];
  const updates = [];
  const messageChain = {
    insert: vi.fn((payload) => {
      inserted.push(payload);
      return { select: () => ({ single: async () => insertResult }) };
    }),
    update: vi.fn((payload) => {
      updates.push(payload);
      return {
        eq: () => ({
          select: () => ({
            single: async () => ({
              data: { id: "message-1", delivery_status: "sent", created_at: "2026-01-01T00:00:00.000Z" },
              error: null,
            }),
          }),
        }),
      };
    }),
    select: vi.fn(() => ({
      eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existingMessage, error: null }) }) }),
    })),
  };
  const supabase = {
    from: vi.fn((table) => {
      if (table === "request_conversations") return query(conversationResult);
      if (table === "anfragen") return query(requestResult);
      if (table === "request_messages") return messageChain;
      throw new Error(`Unexpected table ${table}`);
    }),
  };
  const resendClient = {
    emails: {
      send: vi.fn().mockResolvedValue(sentResult),
    },
  };
  return { supabase, resendClient, inserted, updates };
}

const input = {
  coachId: "coach-a",
  conversationId: "conversation-1",
  subject: "Organisatorische Frage",
  text: "Bitte melde dich kurz.",
  clientRequestId: "58d9e08c-f95e-4d94-9877-a97b43256e48",
};

describe("outbound messaging", () => {
  it("stellt die Nachricht vor dem Versand in die Queue und nutzt nur DB-Empfänger und Alias", async () => {
    const { supabase, resendClient, inserted, updates } = createSupabase();

    const result = await sendCoachMessage({ supabase, resendClient, ...input });

    expect(result.ok).toBe(true);
    expect(inserted).toEqual([expect.objectContaining({
      conversation_id: "conversation-1",
      anfrage_id: "request-1",
      delivery_status: "queued",
      direction: "outbound",
      sender_role: "coach",
    })]);
    expect(resendClient.emails.send).toHaveBeenCalledWith(expect.objectContaining({
      from: "Poise <noreply@mypoise.de>",
      to: "client@example.invalid",
      replyTo: "r-safe-token@reply.mypoise.de",
      subject: input.subject,
    }));
    expect(JSON.stringify(resendClient.emails.send.mock.calls)).not.toContain("coach-a@example");
    expect(updates).toContainEqual({
      delivery_status: "sent",
      provider_message_id: "provider-message-1",
    });
  });

  it.each([
    ["fremde Conversation", { therapist_id: "coach-b" }, "CONVERSATION_FORBIDDEN"],
    ["geschlossene Conversation", { status: "closed" }, "CONVERSATION_NOT_OPEN"],
    ["widerrufener Alias", { alias_revoked_at: "2026-01-01T00:00:00.000Z" }, "CONVERSATION_ALIAS_REVOKED"],
  ])("sendet nicht bei %s", async (_label, change, error) => {
    const { supabase, resendClient, inserted } = createSupabase({
      conversationResult: { data: { ...conversation, ...change }, error: null },
    });

    const result = await sendCoachMessage({ supabase, resendClient, ...input });

    expect(result).toEqual({ error });
    expect(inserted).toEqual([]);
    expect(resendClient.emails.send).not.toHaveBeenCalled();
  });

  it("sendet nicht bei abweichender aktueller Coach-Zuweisung oder fehlendem Empfänger", async () => {
    const mismatch = createSupabase({
      requestResult: { data: { ...request, assigned_therapist_id: "coach-b" }, error: null },
    });
    const unavailable = createSupabase({
      requestResult: { data: { ...request, email: null }, error: null },
    });

    await expect(sendCoachMessage({ supabase: mismatch.supabase, resendClient: mismatch.resendClient, ...input }))
      .resolves.toEqual({ error: "ASSIGNMENT_MISMATCH" });
    await expect(sendCoachMessage({ supabase: unavailable.supabase, resendClient: unavailable.resendClient, ...input }))
      .resolves.toEqual({ error: "RECIPIENT_UNAVAILABLE" });
    expect(mismatch.resendClient.emails.send).not.toHaveBeenCalled();
    expect(unavailable.resendClient.emails.send).not.toHaveBeenCalled();
  });

  it("markiert die persistierte Nachricht bei Provider-Fehler als failed", async () => {
    const { supabase, resendClient, updates } = createSupabase({
      sentResult: { data: null, error: { message: "provider failure" } },
    });

    const result = await sendCoachMessage({ supabase, resendClient, ...input });

    expect(result).toEqual({ error: "MESSAGE_SEND_FAILED" });
    expect(updates).toContainEqual({ delivery_status: "failed" });
  });

  it("behandelt einen wiederholten Idempotency-Key ohne zweiten Versand", async () => {
    const { supabase, resendClient } = createSupabase({
      insertResult: { data: null, error: { code: "23505" } },
      existingMessage: { id: "message-1", delivery_status: "sent" },
    });

    const result = await sendCoachMessage({ supabase, resendClient, ...input });

    expect(result).toEqual({
      ok: true,
      message: { id: "message-1", delivery_status: "sent" },
      duplicate: true,
    });
    expect(resendClient.emails.send).not.toHaveBeenCalled();
  });

  it("enthält keinen Coach-Absender im Mail-Payload", () => {
    const mail = createOutboundMail({
      to: "client@example.invalid",
      subject: "Betreff",
      text: "Text",
      replyAlias: "r-safe-token@reply.mypoise.de",
    });

    expect(mail.from).toBe("Poise <noreply@mypoise.de>");
    expect(mail.replyTo).toBe("r-safe-token@reply.mypoise.de");
    expect(mail).not.toHaveProperty("coachEmail");
  });
});