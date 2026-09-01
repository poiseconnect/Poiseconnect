export const dynamic = "force-dynamic";

import { Resend } from "resend";
import { getUserFromBearer, json, supabaseAdmin } from "../_lib/server";
import { sendCoachMessage } from "../../lib/messaging/outbound";

export async function POST(req) {
  try {
    const { user } = await getUserFromBearer(req);

    if (!user) {
      return json({ error: "NO_TOKEN" }, 401);
    }

    const body = await req.json();
    const { requestId, subject, message } = body;

    if (!requestId || !subject || !message) {
      return json({ error: "missing_data" }, 400);
    }

    const supabase = supabaseAdmin();
    const { data: coach, error: coachError } = await supabase
      .from("team_members")
      .select("id, role, active")
      .eq("user_id", user.id)
      .single();

    if (coachError || !coach || coach.active !== true || coach.role !== "therapist") {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const { data: conversation, error: conversationError } = await supabase
      .from("request_conversations")
      .select("id")
      .eq("anfrage_id", requestId)
      .eq("therapist_id", coach.id)
      .eq("status", "open")
      .single();

    if (conversationError || !conversation) {
      return json({ error: "CONVERSATION_NOT_FOUND" }, 404);
    }

    const result = await sendCoachMessage({
      supabase,
      resendClient: new Resend(process.env.RESEND_API_KEY),
      coachId: coach.id,
      conversationId: conversation.id,
      subject: String(subject || "").trim(),
      text: String(message || "").trim(),
      clientRequestId: null,
    });

    if (!result.ok) return json({ error: result.error }, 409);
    return json({ ok: true, message: result.message });
  } catch {
    return json({ error: "MESSAGE_SEND_UNAVAILABLE" }, 500);
  }
}
