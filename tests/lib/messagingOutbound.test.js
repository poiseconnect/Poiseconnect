import { describe, expect, it, vi } from "vitest";
import {
  createOutboundMail,
  sendClientMessage,
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
      reply_to: "r-safe-token@reply.mypoise.de",
      subject: input.subject,
    }));
    expect(resendClient.emails.send.mock.calls[0][0]).not.toHaveProperty("replyTo");
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

  it("verwendet den Resend reply_to-Contract ohne camelCase-Alternative", () => {
    const mail = createOutboundMail({
      to: "client@example.invalid",
      subject: "Betreff",
      text: "Text",
      replyAlias: "r-safe-token@reply.mypoise.de",
    });

    expect(mail.from).toBe("Poise <noreply@mypoise.de>");
    expect(mail.reply_to).toBe("r-safe-token@reply.mypoise.de");
    expect(mail).not.toHaveProperty("replyTo");
    expect(mail).not.toHaveProperty("coachEmail");
  });
});

describe("sendClientMessage (Proposal-Fallback)", () => {
  const clientConversation = {
    id: "conversation-1",
    anfrage_id: "request-1",
    therapist_id: "coach-a",
    status: "open",
    reply_alias: "r-client-fallback-token@reply.mypoise.de",
    alias_revoked_at: null,
  };

  const anfrage = {
    id: "request-1",
    assigned_therapist_id: "coach-a",
  };

  const coach = {
    id: "coach-a",
    email: "coach@example.invalid",
    active: true,
    role: "therapist",
  };

  function createClientMessageSupabase({
    anfrageResult = { data: anfrage, error: null },
    conversationResult = { data: clientConversation, error: null },
    coachResult = { data: coach, error: null },
    insertResult = { data: { id: "message-1", delivery_status: "received" }, error: null },
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
                data: { id: "message-1", delivery_status: "forwarded", created_at: "2026-01-01T00:00:00.000Z" },
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
        if (table === "anfragen") return query(anfrageResult);
        if (table === "request_conversations") return query(conversationResult, "maybeSingle");
        if (table === "team_members") return query(coachResult);
        if (table === "request_messages") return messageChain;
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    const resendClient = { emails: { send: vi.fn().mockResolvedValue(sentResult) } };
    return { supabase, resendClient, inserted, updates };
  }

  const clientInput = {
    anfrageId: "request-1",
    subject: "Rückmeldung zu Terminvorschlägen",
    text: "Nächste Woche würde vormittags besser passen.",
    clientRequestId: "58d9e08c-f95e-4d94-9877-a97b43256e48",
  };

  it("stellt die Nachricht in die Queue, sendet an die Coach-Adresse mit reply_to und markiert sie als forwarded", async () => {
    const { supabase, resendClient, inserted, updates } = createClientMessageSupabase();

    const result = await sendClientMessage({ supabase, resendClient, ...clientInput });

    expect(result.ok).toBe(true);
    expect(inserted).toEqual([expect.objectContaining({
      conversation_id: "conversation-1",
      anfrage_id: "request-1",
      direction: "inbound",
      sender_role: "client",
      delivery_status: "received",
    })]);
    expect(resendClient.emails.send).toHaveBeenCalledWith(expect.objectContaining({
      to: "coach@example.invalid",
      reply_to: clientConversation.reply_alias,
    }));
    expect(resendClient.emails.send.mock.calls[0][0]).not.toHaveProperty("replyTo");
    expect(updates).toContainEqual(expect.objectContaining({ delivery_status: "forwarded" }));
  });

  it("lehnt ab, wenn die Anfrage keinem Coach zugewiesen ist", async () => {
    const { supabase, resendClient } = createClientMessageSupabase({
      anfrageResult: { data: { id: "request-1", assigned_therapist_id: null }, error: null },
    });

    const result = await sendClientMessage({ supabase, resendClient, ...clientInput });

    expect(result).toEqual({ error: "REQUEST_NOT_FOUND" });
    expect(resendClient.emails.send).not.toHaveBeenCalled();
  });

  it("lehnt ab, wenn keine offene Conversation existiert", async () => {
    const { supabase, resendClient } = createClientMessageSupabase({
      conversationResult: { data: null, error: null },
    });

    const result = await sendClientMessage({ supabase, resendClient, ...clientInput });

    expect(result).toEqual({ error: "CONVERSATION_NOT_FOUND" });
    expect(resendClient.emails.send).not.toHaveBeenCalled();
  });

  it("lehnt ab, wenn der Alias der offenen Conversation widerrufen ist", async () => {
    const { supabase, resendClient } = createClientMessageSupabase({
      conversationResult: { data: { ...clientConversation, alias_revoked_at: "2026-01-01T00:00:00.000Z" }, error: null },
    });

    const result = await sendClientMessage({ supabase, resendClient, ...clientInput });

    expect(result).toEqual({ error: "CONVERSATION_ALIAS_REVOKED" });
    expect(resendClient.emails.send).not.toHaveBeenCalled();
  });

  it("lehnt ab, wenn die Conversation einem anderen als dem aktuell zugewiesenen Coach gehört", async () => {
    const { supabase, resendClient } = createClientMessageSupabase({
      conversationResult: { data: { ...clientConversation, therapist_id: "coach-b" }, error: null },
    });

    const result = await sendClientMessage({ supabase, resendClient, ...clientInput });

    expect(result).toEqual({ error: "ASSIGNMENT_MISMATCH" });
    expect(resendClient.emails.send).not.toHaveBeenCalled();
  });

  it("lehnt ab, wenn der Coach inaktiv ist oder keine Therapeutenrolle hat", async () => {
    const inactive = createClientMessageSupabase({
      coachResult: { data: { ...coach, active: false }, error: null },
    });
    const wrongRole = createClientMessageSupabase({
      coachResult: { data: { ...coach, role: "admin" }, error: null },
    });

    await expect(sendClientMessage({ supabase: inactive.supabase, resendClient: inactive.resendClient, ...clientInput }))
      .resolves.toEqual({ error: "COACH_UNAVAILABLE" });
    await expect(sendClientMessage({ supabase: wrongRole.supabase, resendClient: wrongRole.resendClient, ...clientInput }))
      .resolves.toEqual({ error: "COACH_UNAVAILABLE" });
    expect(inactive.resendClient.emails.send).not.toHaveBeenCalled();
    expect(wrongRole.resendClient.emails.send).not.toHaveBeenCalled();
  });

  it("lehnt ab, wenn keine gültige Coach-E-Mail hinterlegt ist", async () => {
    const { supabase, resendClient } = createClientMessageSupabase({
      coachResult: { data: { ...coach, email: null }, error: null },
    });

    const result = await sendClientMessage({ supabase, resendClient, ...clientInput });

    expect(result).toEqual({ error: "RECIPIENT_UNAVAILABLE" });
    expect(resendClient.emails.send).not.toHaveBeenCalled();
  });

  it("behandelt einen wiederholten Idempotency-Key ohne zweiten Versand", async () => {
    const { supabase, resendClient } = createClientMessageSupabase({
      insertResult: { data: null, error: { code: "23505" } },
      existingMessage: { id: "message-1", delivery_status: "forwarded" },
    });

    const result = await sendClientMessage({ supabase, resendClient, ...clientInput });

    expect(result).toEqual({
      ok: true,
      message: { id: "message-1", delivery_status: "forwarded" },
      duplicate: true,
    });
    expect(resendClient.emails.send).not.toHaveBeenCalled();
  });

  it("markiert die Nachricht bei einem Provider-Fehler als failed", async () => {
    const { supabase, resendClient, updates } = createClientMessageSupabase({
      sentResult: { data: null, error: { message: "provider failure" } },
    });

    const result = await sendClientMessage({ supabase, resendClient, ...clientInput });

    expect(result).toEqual({ error: "MESSAGE_SEND_FAILED" });
    expect(updates).toContainEqual({ delivery_status: "failed" });
  });
});