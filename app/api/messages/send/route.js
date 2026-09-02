export const dynamic = "force-dynamic";

import { Resend } from "resend";
import { getUserFromBearer, json, supabaseAdmin } from "../../_lib/server";
import { sendCoachMessage } from "../../../lib/messaging/outbound";

function isNonEmptyText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request) {
  try {
    if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
      return json({ error: "NO_TOKEN" }, 401);
    }

    const { user, error: authError } = await getUserFromBearer(request);
    if (!user) return json({ error: authError || "NO_TOKEN" }, 401);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }

    const { conversationId, subject, text } = body || {};
    const clientRequestId = request.headers.get("idempotency-key") || null;

    if (!conversationId || !isNonEmptyText(subject, 200) || !isNonEmptyText(text, 10000)) {
      return json({ error: "INVALID_MESSAGE" }, 400);
    }

    if (clientRequestId && !isUuid(clientRequestId)) {
      return json({ error: "INVALID_IDEMPOTENCY_KEY" }, 400);
    }

    const sb = supabaseAdmin();
    const { data: coach, error: coachError } = await sb
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (coachError || !coach || coach.active !== true || coach.role !== "therapist") {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const result = await sendCoachMessage({
      supabase: sb,
      resendClient: new Resend(process.env.RESEND_API_KEY),
      coachId: coach.id,
      conversationId,
      subject: subject.trim(),
      text: text.trim(),
      clientRequestId,
    });

    if (!result.ok) {
      const status = ["CONVERSATION_FORBIDDEN", "ASSIGNMENT_MISMATCH"].includes(result.error)
        ? 403
        : result.error === "RECIPIENT_UNAVAILABLE"
          ? 422
          : result.error === "CONVERSATION_NOT_FOUND" || result.error === "REQUEST_NOT_FOUND"
            ? 404
            : 409;
      return json({ error: result.error }, status);
    }

    return json({ ok: true, message: result.message, duplicate: result.duplicate === true });
  } catch {
    return json({ error: "MESSAGE_SEND_UNAVAILABLE" }, 500);
  }
}