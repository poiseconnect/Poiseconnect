import { describe, expect, it, vi } from "vitest";
import { processInboundResendEvent } from "../../app/lib/messaging/inbound.js";

const event = { id: "event-1", type: "email.received", data: { email_id: "email-1" } };
const replyAlias = "r-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@reply.mypoise.de";
const receivedEmail = {
  to: [replyAlias],
  from: "client@example.invalid",
  subject: "Rückfrage",
  text: "Danke für die Nachricht.",
  html: "<p>Danke für die Nachricht.</p>",
};

function createSupabase({
  eventInsert = { data: { id: "ledger-1" }, error: null },
  conversation = { id: "conversation-1", anfrage_id: "request-1", therapist_id: "coach-1", status: "open", alias_revoked_at: null },
  anfrage = { id: "request-1", email: "client@example.invalid", assigned_therapist_id: "coach-1" },
  coach = { id: "coach-1", email: "coach@example.invalid", active: true, role: "therapist" },
  messageInsert = { data: { id: "message-1" }, error: null },
} = {}) {
  const inserts = [];
  const updates = [];
  const chain = (result, method = "single") => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      single: vi.fn().mockResolvedValue(result),
      maybeSingle: vi.fn().mockResolvedValue(result),
    };
    return { ...query, [method]: vi.fn().mockResolvedValue(result) };
  };
  return {
    inserts,
    updates,
    from: vi.fn((table) => {
      if (table === "request_message_events") {
        return {
          insert: vi.fn((payload) => {
            inserts.push({ table, payload });
            return { select: () => ({ single: async () => eventInsert }) };
          }),
          update: vi.fn((payload) => {
            updates.push({ table, payload });
            return { eq: () => ({}) };
          }),
        };
      }
      if (table === "request_conversations") return chain({ data: conversation, error: null }, "maybeSingle");
      if (table === "anfragen") return chain({ data: anfrage, error: null });
      if (table === "team_members") return chain({ data: coach, error: null });
      if (table === "request_messages") {
        return {
          insert: vi.fn((payload) => {
            inserts.push({ table, payload });
            return { select: () => ({ single: async () => messageInsert }) };
          }),
          update: vi.fn((payload) => {
            updates.push({ table, payload });
            return { eq: () => ({}) };
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function setupEnvironment() {
  process.env.RESEND_REPLY_DOMAIN = "reply.mypoise.de";
  process.env.RESEND_API_KEY = "test-key";
}

describe("inbound messaging", () => {
  it("speichert das signierte Event im Ledger und ignoriert nicht erwartete Events", async () => {
    setupEnvironment();
    const supabase = createSupabase({ conversation: null });

    const result = await processInboundResendEvent({
      supabase,
      event: { id: "event-2", type: "email.delivered", data: {} },
    });

    expect(result).toEqual({ ok: true, ignored: true });
    expect(supabase.inserts).toContainEqual(expect.objectContaining({
      table: "request_message_events",
      payload: expect.objectContaining({ provider: "resend", provider_event_id: "event-2" }),
    }));
  });

  it("beendet doppelte Events ohne einen zweiten Abruf oder Forward", async () => {
    setupEnvironment();
    const supabase = createSupabase({ eventInsert: { data: null, error: { code: "23505" } } });
    const fetchImpl = vi.fn();
    const resendClient = { emails: { send: vi.fn() } };

    const result = await processInboundResendEvent({ supabase, event, fetchImpl, resendClient });

    expect(result).toEqual({ ok: true, duplicate: true });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(resendClient.emails.send).not.toHaveBeenCalled();
  });

  it("legt unbekannte Aliase als Review ohne Anfragezuordnung an", async () => {
    setupEnvironment();
    const supabase = createSupabase({ conversation: null });
    const email = { ...receivedEmail, to: ["r-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb@reply.mypoise.de"] };

    const result = await processInboundResendEvent({
      supabase,
      event,
      fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => email }),
      resendClient: { emails: { send: vi.fn() } },
    });

    expect(result).toEqual({ ok: true, review: true });
    expect(supabase.inserts).toContainEqual(expect.objectContaining({
      table: "request_messages",
      payload: expect.objectContaining({
        conversation_id: null,
        anfrage_id: null,
        delivery_status: "review",
      }),
    }));
  });

  it.each([
    ["widerrufenen Alias", { alias_revoked_at: "2026-01-01T00:00:00.000Z" }],
    ["geschlossene Conversation", { status: "closed" }],
  ])("legt %s als Review an", async (_label, change) => {
    setupEnvironment();
    const supabase = createSupabase({ conversation: { id: "conversation-1", anfrage_id: "request-1", therapist_id: "coach-1", status: "open", alias_revoked_at: null, ...change } });
    const resendClient = { emails: { send: vi.fn() } };

    const result = await processInboundResendEvent({
      supabase,
      event,
      fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => receivedEmail }),
      resendClient,
    });

    expect(result).toEqual({ ok: true, review: true });
    expect(resendClient.emails.send).not.toHaveBeenCalled();
  });

  it("speichert eine valide Nachricht vor dem Forward und verwendet nur die Coach-Adresse aus der DB", async () => {
    setupEnvironment();
    const supabase = createSupabase();
    const resendClient = { emails: { send: vi.fn().mockResolvedValue({ data: { id: "forward-1" }, error: null }) } };

    const result = await processInboundResendEvent({
      supabase,
      event,
      fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => receivedEmail }),
      resendClient,
    });

    expect(result).toEqual({ ok: true, forwarded: true });
    expect(supabase.inserts.find((entry) => entry.table === "request_messages")?.payload).toEqual(expect.objectContaining({
      conversation_id: "conversation-1",
      anfrage_id: "request-1",
      delivery_status: "received",
      direction: "inbound",
    }));
    expect(resendClient.emails.send).toHaveBeenCalledWith(expect.objectContaining({
      to: "coach@example.invalid",
      replyTo: replyAlias,
      headers: { "X-Poise-Messaging": "inbound-forward-v1" },
    }));
    expect(supabase.updates).toContainEqual(expect.objectContaining({
      table: "request_messages",
      payload: { delivery_status: "forwarded" },
    }));
  });

  it("markiert eine persistierte Nachricht bei Forward-Fehler als failed", async () => {
    setupEnvironment();
    const supabase = createSupabase();

    const result = await processInboundResendEvent({
      supabase,
      event,
      fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => receivedEmail }),
      resendClient: { emails: { send: vi.fn().mockResolvedValue({ data: null, error: { code: "failed" } }) } },
    });

    expect(result).toEqual({ ok: true, failed: true });
    expect(supabase.updates).toContainEqual(expect.objectContaining({
      table: "request_messages",
      payload: { delivery_status: "failed" },
    }));
  });

  it.each([
    ["abweichender aktueller Coach-Zuordnung", { anfrage: { id: "request-1", assigned_therapist_id: "coach-2" } }],
    ["inaktivem Coach", { coach: { id: "coach-1", email: "coach@example.invalid", active: false, role: "therapist" } }],
  ])("legt Nachrichten bei %s als Review an", async (_label, setup) => {
    setupEnvironment();
    const supabase = createSupabase(setup);
    const resendClient = { emails: { send: vi.fn() } };

    const result = await processInboundResendEvent({
      supabase,
      event,
      fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => receivedEmail }),
      resendClient,
    });

    expect(result).toEqual({ ok: true, review: true });
    expect(resendClient.emails.send).not.toHaveBeenCalled();
    expect(supabase.inserts).toContainEqual(expect.objectContaining({
      table: "request_messages",
      payload: expect.objectContaining({ delivery_status: "review" }),
    }));
  });

  it("leitet eine Antwort des aktuellen Coachs als Outbound-Nachricht an die DB-Klient:innenadresse weiter", async () => {
    setupEnvironment();
    const supabase = createSupabase();
    const resendClient = { emails: { send: vi.fn() } };

    const result = await processInboundResendEvent({
      supabase,
      event,
      fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...receivedEmail, from: "coach@example.invalid" }) }),
      resendClient,
    });

    expect(result).toEqual({ ok: true, sent: true });
    expect(resendClient.emails.send).toHaveBeenCalledWith(expect.objectContaining({
      to: "client@example.invalid",
      replyTo: replyAlias,
    }));
    expect(supabase.inserts).toContainEqual(expect.objectContaining({
      table: "request_messages",
      payload: expect.objectContaining({ direction: "outbound", sender_role: "coach" }),
    }));
  });

  it("leitet eigene Forwarding-Nachrichten nicht erneut weiter", async () => {
    setupEnvironment();
    const supabase = createSupabase();
    const resendClient = { emails: { send: vi.fn() } };

    const result = await processInboundResendEvent({
      supabase,
      event,
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...receivedEmail,
          headers: { "X-Poise-Messaging": "inbound-forward-v1" },
        }),
      }),
      resendClient,
    });

    expect(result).toEqual({ ok: true, review: true });
    expect(resendClient.emails.send).not.toHaveBeenCalled();
  });
});