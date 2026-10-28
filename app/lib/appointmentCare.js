// Context is a snapshot, not a lock spanning HTTP. Writes additionally need a
// persistent operation claim. Transferred cases require an explicit current
// version; proposals must use their DB-stamped version, never a caller override.
export async function appointmentCareContext(
  supabase,
  requestId,
  coachId,
  { link = false, expectedVersion = null } = {}
) {
  let result;
  try {
    result = await supabase.rpc("privacy_appointment_context", {
      p_request_id: requestId,
      p_expected_coach_id: coachId || null,
      p_expected_care_version: expectedVersion,
    });
  } catch {
    return { error: "APPOINTMENT_CONTEXT_UNAVAILABLE", status: 503 };
  }
  const data = result?.data;
  const version = data?.careVersion;
  if (!result?.error && data?.allowed === false) {
    return { error: "APPOINTMENT_ASSIGNMENT_CHANGED", status: 409 };
  }
  if (
    result?.error ||
    !data ||
    typeof data.allowed !== "boolean" ||
    !(
      (typeof version === "number" && Number.isSafeInteger(version) && version >= 0) ||
      (typeof version === "string" && /^(0|[1-9]\d*)$/.test(version))
    )
  ) {
    return { error: "APPOINTMENT_CONTEXT_UNAVAILABLE", status: 503 };
  }
  const boundVersion =
    (typeof expectedVersion === "number" && Number.isSafeInteger(expectedVersion) && expectedVersion >= 0) ||
    (typeof expectedVersion === "string" && /^(0|[1-9]\d*)$/.test(expectedVersion));
  if (BigInt(version) > 0n && !boundVersion) {
    return {
      error: link ? "APPOINTMENT_REBIND_REQUIRED" : "APPOINTMENT_TRANSFER_PAUSED",
      status: 409,
    };
  }
  if (
    !data.allowed ||
    !coachId ||
    String(data.coachId) !== String(coachId) ||
    (boundVersion && BigInt(version) !== BigInt(expectedVersion))
  ) {
    return { error: "APPOINTMENT_ASSIGNMENT_CHANGED", status: 409 };
  }
  return { careVersion: version, coachId: data.coachId };
}

export async function beginAppointmentOperation(supabase, requestId, coachId, careVersion = 0) {
  const operationId = randomUUID();
  try {
    const { data, error } = await supabase.rpc("privacy_begin_appointment_operation", {
      p_request_id: requestId,
      p_expected_coach_id: coachId,
      p_expected_version: careVersion,
      p_operation_id: operationId,
    });
    if (
      !error && data?.allowed === true && String(data.careVersion) === String(careVersion) &&
      data.coachId === coachId && data.operationId === operationId
    ) {
      return { operationId, supabase };
    }
    const conflict = (!error && data?.allowed === false) || error?.message === "CARE_VERSION_CONFLICT";
    return {
      error: conflict
        ? "APPOINTMENT_ASSIGNMENT_CHANGED" : "APPOINTMENT_OPERATION_UNAVAILABLE",
      status: conflict ? 409 : 503,
    };
  } catch (error) {
    return error?.message === "CARE_VERSION_CONFLICT"
      ? { error: "APPOINTMENT_ASSIGNMENT_CHANGED", status: 409 }
      : { error: "APPOINTMENT_OPERATION_UNAVAILABLE", status: 503 };
  }
}

export async function endAppointmentOperation(operation) {
  try {
    const { data, error } = await operation.supabase.rpc("privacy_end_appointment_operation", {
      p_operation_id: operation.operationId,
    });
    return !error && data?.allowed === true && data.operationId === operation.operationId;
  } catch {
    return false;
  }
}

// A persistent claim, rather than a DB transaction held across HTTP, fences
// transfers. Errors/timeouts deliberately leave the claim pending for review.
export async function withAppointmentOperation(handler) {
  let operation;
  let unknown = false;
  const response = await handler({
    markUnknown() { unknown = true; },
    async begin(supabase, requestId, coachId, careVersion = 0) {
      const result = await beginAppointmentOperation(supabase, requestId, coachId, careVersion);
      if (!result.error) operation = result;
      return result;
    },
  });
  if (operation && response.ok && (unknown || !(await endAppointmentOperation(operation)))) {
    return Response.json({ error: "APPOINTMENT_OPERATION_PENDING" }, { status: 503 });
  }
  return response;
}
import { randomUUID } from "node:crypto";
