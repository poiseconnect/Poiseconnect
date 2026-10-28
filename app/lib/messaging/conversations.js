import { createReplyAlias } from "./aliases";
import { authorizeMessagingContext } from "./access";

function requireId(value, name) {
  if (!value) {
    throw new Error(`${name}_MISSING`);
  }
}

export async function ensureOpenConversation({
  supabase,
  anfrageId,
  therapistId,
}) {
  requireId(anfrageId, "ANFRAGE_ID");
  requireId(therapistId, "THERAPIST_ID");

  const access = await authorizeMessagingContext(supabase, {
    requestId: anfrageId,
    coachId: therapistId,
  });
  if (!access.ok) {
    if (access.error === "MESSAGING_ACCESS_DENIED" || access.error === "MESSAGING_CONTENT_PAUSED") {
      return { id: null, status: "pending", reply_alias: null };
    }
    throw new Error(access.error);
  }

  const { replyAlias, replyTokenHash } = createReplyAlias();
  const { data, error } = await supabase.rpc(
    "ensure_open_request_conversation",
    {
      p_anfrage_id: anfrageId,
      p_therapist_id: therapistId,
      p_reply_alias: replyAlias,
      p_reply_token_hash: replyTokenHash,
    }
  );

  if (error || !data) {
    throw new Error("CONVERSATION_ENSURE_FAILED");
  }

  return data;
}

export async function closeConversation({ supabase, anfrageId, reason }) {
  requireId(anfrageId, "ANFRAGE_ID");

  const { error } = await supabase.rpc(
    "close_open_request_conversation",
    {
      p_anfrage_id: anfrageId,
      p_reason: reason || null,
    }
  );

  if (error) {
    throw new Error("CONVERSATION_CLOSE_FAILED");
  }
}