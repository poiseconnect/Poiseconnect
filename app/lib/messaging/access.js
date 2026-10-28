import { getMessagingAccess } from "../intakeAccess.js";

function isNonEmptyId(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseCareVersion(value) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }

  return null;
}

export async function authorizeMessagingContext(supabase, input) {
  let context;
  try {
    context = await getMessagingAccess(supabase, input);
  } catch (error) {
    if (error?.message === "MESSAGING_ACCESS_UNAVAILABLE") {
      return { ok: false, error: "MESSAGING_ACCESS_UNAVAILABLE" };
    }
    throw error;
  }

  if (!context || typeof context !== "object" || typeof context.allowed !== "boolean") {
    return { ok: false, error: "MESSAGING_ACCESS_UNAVAILABLE" };
  }

  if (!context.allowed) {
    if (context.reason === "MESSAGING_CONTENT_PAUSED") {
      return { ok: false, error: "MESSAGING_CONTENT_PAUSED" };
    }
    return { ok: false, error: "MESSAGING_ACCESS_DENIED" };
  }

  const careVersion = parseCareVersion(context.careVersion);
  if (
    !isNonEmptyId(context.requestId) ||
    (context.conversationId !== null && !isNonEmptyId(context.conversationId)) ||
    careVersion === null ||
    (input.requestId && String(context.requestId) !== String(input.requestId)) ||
    (input.conversationId && String(context.conversationId) !== String(input.conversationId))
  ) {
    return { ok: false, error: "MESSAGING_ACCESS_UNAVAILABLE" };
  }

  const normalizedContext = {
    ...context,
    requestId: context.requestId,
    conversationId: context.conversationId,
    careVersion,
  };

  return { ok: true, context: normalizedContext };
}

export function getMessagingDispatchAvailability() {
  // Keep content delivery paused until DB-side dispatch reservations can cover provider races.
  return { ok: false, error: "MESSAGING_CONTENT_PAUSED" };
}

export function messagingErrorStatus(error) {
  if (error === "MESSAGING_ACCESS_DENIED") return 403;
  if (error === "MESSAGING_ACCESS_UNAVAILABLE" || error === "MESSAGING_CONTENT_PAUSED") return 503;
  return null;
}
