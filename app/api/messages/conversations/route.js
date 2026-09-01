export const dynamic = "force-dynamic";

import { getUserFromBearer, json, supabaseAdmin } from "../../_lib/server";

export async function GET(request) {
  try {
    const { user, error: authError } = await getUserFromBearer(request);
    if (!user) return json({ error: authError || "NO_TOKEN" }, 401);

    const anfrageId = new URL(request.url).searchParams.get("anfrageId");
    if (!anfrageId) return json({ error: "MISSING_ANFRAGE_ID" }, 400);

    const sb = supabaseAdmin();
    const { data: coach, error: coachError } = await sb
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (coachError || !coach || coach.active !== true || coach.role !== "therapist") {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const { data: anfrage, error: requestError } = await sb
      .from("anfragen")
      .select("id, assigned_therapist_id")
      .eq("id", anfrageId)
      .single();

    if (requestError || !anfrage) return json({ error: "REQUEST_NOT_FOUND" }, 404);
    if (String(anfrage.assigned_therapist_id) !== String(coach.id)) {
      return json({ error: "CONVERSATION_FORBIDDEN" }, 403);
    }

    const { data: conversation, error: conversationError } = await sb
      .from("request_conversations")
      .select("id, status, therapist_id, anfrage_id, created_at, closed_at")
      .eq("anfrage_id", anfrage.id)
      .eq("therapist_id", coach.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conversationError) return json({ error: "CONVERSATION_LOAD_FAILED" }, 500);
    if (!conversation) return json({ conversation: null, messages: [] });

    const { data: messages, error: messagesError } = await sb
      .from("request_messages")
      .select("id, direction, sender_role, subject, text_body, delivery_status, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (messagesError) return json({ error: "MESSAGE_LOAD_FAILED" }, 500);

    return json({
      conversation: {
        id: conversation.id,
        status: conversation.status,
        created_at: conversation.created_at,
        closed_at: conversation.closed_at,
      },
      messages: messages || [],
    });
  } catch {
    return json({ error: "CONVERSATION_LOAD_UNAVAILABLE" }, 500);
  }
}