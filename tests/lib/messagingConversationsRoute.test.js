import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserFromBearer = vi.hoisted(() => vi.fn());
const supabaseAdmin = vi.hoisted(() => vi.fn());
const ensureOpenConversation = vi.hoisted(() => vi.fn());

vi.mock("../../app/api/_lib/server.js", () => ({
  getUserFromBearer,
  supabaseAdmin,
  json: (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  }),
}));

vi.mock("../../app/lib/messaging/conversations.js", () => ({
  ensureOpenConversation,
}));

import { GET } from "../../app/api/messages/conversations/route.js";

const coach = { id: "coach-a", role: "therapist", active: true };
const request = { id: "request-1", assigned_therapist_id: "coach-a", status: "admin_vorschlaege_gesendet" };
const existingConversation = {
  id: "conversation-1",
  anfrage_id: "request-1",
  therapist_id: "coach-a",
  status: "open",
  created_at: "2026-01-01T00:00:00.000Z",
  closed_at: null,
};
const createdConversation = {
  id: "conversation-created",
  anfrage_id: "request-1",
  therapist_id: "coach-a",
  status: "open",
  created_at: "2026-01-02T00:00:00.000Z",
  closed_at: null,
};

function createQuery(result) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
  };
  return query;
}

function createSupabase({
  coachResult,
  requestResult,
  conversationResult,
  messagesResult,
  messagingAccess = { allowed: true },
} = {}) {
  const queries = {};
  const sb = {
    rpc: vi.fn(async (_name, args) => ({
      data: {
        allowed: messagingAccess.allowed,
        ...(messagingAccess.reason ? { reason: messagingAccess.reason } : {}),
        requestId: args.p_request_id || "request-1",
        conversationId: args.p_conversation_id || null,
        careVersion: 0,
      },
      error: null,
    })),
    from: vi.fn((table) => {
      if (table === "team_members") {
        queries.team_members = createQuery(coachResult || { data: coach, error: null });
        return queries.team_members;
      }
      if (table === "anfragen") {
        queries.anfragen = createQuery(requestResult || { data: request, error: null });
        return queries.anfragen;
      }
      if (table === "request_conversations") {
        queries.request_conversations = createQuery(conversationResult || { data: existingConversation, error: null });
        return queries.request_conversations;
      }
      if (table === "request_messages") {
        queries.request_messages = createQuery(messagesResult || { data: [], error: null });
        return queries.request_messages;
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
  return { sb, queries };
}

function requestFor(anfrageId = "request-1") {
  return new Request(`https://app.example.invalid/api/messages/conversations?anfrageId=${anfrageId}`, {
    headers: { Authorization: "Bearer test-token" },
  });
}

describe("messages conversations route", () => {
  beforeEach(() => {
    getUserFromBearer.mockResolvedValue({ user: { id: "user-1" }, error: null });
    ensureOpenConversation.mockResolvedValue(createdConversation);
    supabaseAdmin.mockReset();
    ensureOpenConversation.mockClear();
  });

  it("creates a missing open conversation on demand for an assigned non-terminal request", async () => {
    const { sb } = createSupabase({ conversationResult: { data: null, error: null } });
    supabaseAdmin.mockReturnValue(sb);

    const response = await GET(requestFor());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      conversation: {
        id: "conversation-created",
        status: "open",
        created_at: "2026-01-02T00:00:00.000Z",
        closed_at: null,
      },
      messages: [],
    });
    expect(ensureOpenConversation).toHaveBeenCalledWith({
      supabase: sb,
      anfrageId: "request-1",
      therapistId: "coach-a",
    });
  });

  it("returns an existing open conversation without creating another one", async () => {
    const { sb } = createSupabase();
    supabaseAdmin.mockReturnValue(sb);

    const response = await GET(requestFor());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.conversation.id).toBe("conversation-1");
    expect(ensureOpenConversation).not.toHaveBeenCalled();
  });

  it("does not create a conversation for another coach", async () => {
    const { sb } = createSupabase({
      coachResult: { data: { ...coach, id: "coach-b" }, error: null },
    });
    supabaseAdmin.mockReturnValue(sb);

    const response = await GET(requestFor());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "CONVERSATION_FORBIDDEN" });
    expect(ensureOpenConversation).not.toHaveBeenCalled();
  });

  it.each(["beendet", "papierkorb", "kein_match", "abgelehnt"])(
    "does not create a conversation for terminal request status %s",
    async (status) => {
      const { sb } = createSupabase({
        requestResult: { data: { ...request, status }, error: null },
        conversationResult: { data: null, error: null },
      });
      supabaseAdmin.mockReturnValue(sb);

      const response = await GET(requestFor());

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ conversation: null, messages: [] });
      expect(ensureOpenConversation).not.toHaveBeenCalled();
    }
  );

  it("creates only a new current-coach conversation after a historical handover", async () => {
    const { sb } = createSupabase({
      coachResult: { data: { ...coach, id: "coach-b" }, error: null },
      requestResult: { data: { ...request, assigned_therapist_id: "coach-b" }, error: null },
      conversationResult: { data: null, error: null },
    });
    supabaseAdmin.mockReturnValue(sb);
    ensureOpenConversation.mockResolvedValue({ ...createdConversation, therapist_id: "coach-b" });

    const response = await GET(requestFor());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.conversation.id).toBe("conversation-created");
    expect(ensureOpenConversation).toHaveBeenCalledWith({
      supabase: sb,
      anfrageId: "request-1",
      therapistId: "coach-b",
    });
  });

  it("does not create a conversation when the request is unassigned", async () => {
    const { sb } = createSupabase({
      requestResult: { data: { ...request, assigned_therapist_id: null }, error: null },
    });
    supabaseAdmin.mockReturnValue(sb);

    const response = await GET(requestFor());

    expect(response.status).toBe(403);
    expect(ensureOpenConversation).not.toHaveBeenCalled();
  });

  it("does not query message bodies or create a conversation when the RPC denies the current coach", async () => {
    const { sb } = createSupabase({
      messagingAccess: { allowed: false, reason: "ASSIGNMENT_NOT_CURRENT" },
      conversationResult: { data: null, error: null },
    });
    supabaseAdmin.mockReturnValue(sb);

    const response = await GET(requestFor());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "MESSAGING_ACCESS_DENIED" });
    expect(sb.from.mock.calls.some(([table]) => table === "request_messages")).toBe(false);
    expect(ensureOpenConversation).not.toHaveBeenCalled();
  });

  it("reports the explicit messaging pause before querying conversations or message bodies", async () => {
    const { sb } = createSupabase({
      messagingAccess: { allowed: false, reason: "MESSAGING_CONTENT_PAUSED" },
      conversationResult: { data: null, error: null },
    });
    supabaseAdmin.mockReturnValue(sb);

    const response = await GET(requestFor());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "MESSAGING_CONTENT_PAUSED" });
    expect(sb.from.mock.calls.some(([table]) =>
      table === "request_conversations" || table === "request_messages"
    )).toBe(false);
    expect(ensureOpenConversation).not.toHaveBeenCalled();
  });
});