import { HEALTH_DATA_FIELDS } from "./healthDataConsent.js";
import { currentMeetingLinkOverride } from "./meetingLinkScope.js";

export async function readRequestHealth(supabase, requestIds, actorId) {
  if (!requestIds.length) return [];
  const { data, error } = await supabase.rpc("privacy_read_request_health", {
    p_request_ids: requestIds,
    p_actor_id: actorId,
  });
  if (error || !Array.isArray(data)) {
    throw new Error("HEALTH_DATA_ACCESS_UNAVAILABLE");
  }
  return data;
}

export function mergeRequestHealth(requests, healthRows) {
  const byId = new Map(healthRows.map((row) => [String(row.id), row]));
  return requests.filter((request) => byId.has(String(request.id))).map((request) => {
    const base = Object.fromEntries(
      Object.entries(request).filter(([key]) => !HEALTH_DATA_FIELDS.includes(key))
    );
    const health = byId.get(String(request.id));
    if (Object.hasOwn(base, "meeting_link_override")) {
      base.meeting_link_override = currentMeetingLinkOverride(request);
    }
    return {
      ...base,
      ...Object.fromEntries(
        HEALTH_DATA_FIELDS.filter((key) => health.__healthAllowed === true && Object.hasOwn(health, key))
          .map((key) => [key, health[key]])
      ),
      sensitiveDataAccessRequired: health.__healthAllowed !== true,
    };
  });
}

export async function getMessagingAccess(supabase, {
  requestId = null, conversationId = null, replyTokenHash = null, coachId = null,
}) {
  const { data, error } = await supabase.rpc("privacy_messaging_context", {
    p_request_id: requestId,
    p_conversation_id: conversationId,
    p_reply_hash: replyTokenHash,
    p_coach_id: coachId,
  });
  if (error || !data || typeof data.allowed !== "boolean") {
    throw new Error("MESSAGING_ACCESS_UNAVAILABLE");
  }
  return data;
}

const TRANSFER_ERRORS = {
  NO_ACCESS: 403,
  REQUEST_NOT_FOUND: 404,
  INVALID_COACH: 400,
  COACH_UNCHANGED: 409,
  CARE_VERSION_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  FUTURE_APPOINTMENTS_REQUIRE_DECISION: 409,
  CARE_OPERATION_IN_PROGRESS: 409,
};

export async function transferRequestCare(supabase, {
  requestId, actorId, handoverType = "therapist_change",
  targetCoachId = null, expectedVersion, operationId,
}) {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0 ||
      typeof operationId !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(operationId)) {
    return { error: "TRANSFER_PRECONDITION_REQUIRED", status: 400 };
  }
  const { data, error } = await supabase.rpc("privacy_handover_request", {
    p_request_id: requestId,
    p_actor_id: actorId,
    p_handover_type: handoverType,
    p_target_coach_id: targetCoachId,
    p_expected_version: expectedVersion,
    p_operation_id: operationId,
  });
  if (error || data?.ok !== true) {
    const code = error?.message;
    if (Object.hasOwn(TRANSFER_ERRORS, code || "")) {
      return { error: code, status: TRANSFER_ERRORS[code] };
    }
    console.error("CARE_TRANSFER_UNAVAILABLE", { code: error?.code || null });
    return { error: "CARE_TRANSFER_UNAVAILABLE", status: 503 };
  }
  return { data, status: 200 };
}
