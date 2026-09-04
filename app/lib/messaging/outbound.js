import { Resend } from "resend";

const DEFAULT_FROM = "Poise <noreply@mypoise.de>";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function getMessagingFrom() {
  return process.env.RESEND_MESSAGING_FROM || process.env.RESEND_FROM || DEFAULT_FROM;
}

export function createOutboundMail({ to, subject, text, replyAlias }) {
  return {
    from: getMessagingFrom(),
    to,
    reply_to: replyAlias,
    subject,
    text: `${text}\n\nDiese Nachricht wurde über Poise übermittelt. Du kannst direkt auf diese E-Mail antworten. Bitte keine sensiblen Gesundheitsinformationen per E-Mail senden.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;"><div style="white-space:pre-line;">${escapeHtml(text)}</div><p style="margin-top:24px;font-size:13px;color:#666;">Diese Nachricht wurde über Poise übermittelt. Du kannst direkt auf diese E-Mail antworten.</p><p style="font-size:13px;color:#666;">Bitte keine sensiblen Gesundheitsinformationen per E-Mail senden.</p></div>`,
  };
}

export async function sendOutboundMail(mail, resendClient = new Resend(process.env.RESEND_API_KEY)) {
  return resendClient.emails.send(mail);
}

function isValidRecipient(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

async function findExistingMessage(supabase, conversationId, clientRequestId) {
  const { data } = await supabase
    .from("request_messages")
    .select("id, delivery_status")
    .eq("conversation_id", conversationId)
    .eq("client_request_id", clientRequestId)
    .maybeSingle();

  return data || null;
}

export async function sendCoachMessage({
  supabase,
  resendClient,
  coachId,
  conversationId,
  subject,
  text,
  clientRequestId,
}) {
  const { data: conversation, error: conversationError } = await supabase
    .from("request_conversations")
    .select("id, anfrage_id, therapist_id, status, reply_alias, alias_revoked_at")
    .eq("id", conversationId)
    .single();

  if (conversationError || !conversation) return { error: "CONVERSATION_NOT_FOUND" };
  if (String(conversation.therapist_id) !== String(coachId)) return { error: "CONVERSATION_FORBIDDEN" };
  if (conversation.status !== "open") return { error: "CONVERSATION_NOT_OPEN" };
  if (conversation.alias_revoked_at) return { error: "CONVERSATION_ALIAS_REVOKED" };

  const { data: anfrage, error: requestError } = await supabase
    .from("anfragen")
    .select("id, email, assigned_therapist_id")
    .eq("id", conversation.anfrage_id)
    .single();

  if (requestError || !anfrage) return { error: "REQUEST_NOT_FOUND" };
  if (String(anfrage.assigned_therapist_id) !== String(coachId)) return { error: "ASSIGNMENT_MISMATCH" };
  if (!isValidRecipient(anfrage.email)) return { error: "RECIPIENT_UNAVAILABLE" };

  const { data: queuedMessage, error: insertError } = await supabase
    .from("request_messages")
    .insert({
      conversation_id: conversation.id,
      anfrage_id: anfrage.id,
      direction: "outbound",
      sender_role: "coach",
      delivery_status: "queued",
      client_request_id: clientRequestId,
      subject,
      text_body: text,
    })
    .select("id, delivery_status")
    .single();

  if (insertError) {
    if (insertError.code === "23505" && clientRequestId) {
      const existingMessage = await findExistingMessage(
        supabase,
        conversation.id,
        clientRequestId
      );
      if (existingMessage) return { ok: true, message: existingMessage, duplicate: true };
    }
    return { error: "MESSAGE_QUEUE_FAILED" };
  }

  const mail = createOutboundMail({
    to: anfrage.email,
    subject,
    text,
    replyAlias: conversation.reply_alias,
  });

  try {
    const result = await sendOutboundMail(mail, resendClient);
    if (result?.error) throw new Error("RESEND_SEND_FAILED");

    const { data: sentMessage, error: sentUpdateError } = await supabase
      .from("request_messages")
      .update({
        delivery_status: "sent",
        provider_message_id: result?.data?.id || null,
      })
      .eq("id", queuedMessage.id)
      .select("id, delivery_status, created_at")
      .single();

    if (sentUpdateError || !sentMessage) return { error: "MESSAGE_STATUS_UPDATE_FAILED" };
    return { ok: true, message: sentMessage };
  } catch {
    await supabase
      .from("request_messages")
      .update({ delivery_status: "failed" })
      .eq("id", queuedMessage.id);

    return { error: "MESSAGE_SEND_FAILED" };
  }
}

// Muss mit dem Loop-Marker in app/lib/messaging/inbound.js übereinstimmen.
const FORWARD_HEADER = "X-Poise-Messaging";
const FORWARD_VALUE = "inbound-forward-v1";

// Client-initiierter Fallback-Kanal (z. B. Proposal-Seite), keine Alias-Mail-Verarbeitung.
export async function sendClientMessage({
  supabase,
  resendClient,
  anfrageId,
  subject,
  text,
  clientRequestId,
}) {
  const { data: anfrage, error: requestError } = await supabase
    .from("anfragen")
    .select("id, assigned_therapist_id")
    .eq("id", anfrageId)
    .single();

  if (requestError || !anfrage || !anfrage.assigned_therapist_id) return { error: "REQUEST_NOT_FOUND" };

  const { data: conversation, error: conversationError } = await supabase
    .from("request_conversations")
    .select("id, anfrage_id, therapist_id, status, reply_alias, alias_revoked_at")
    .eq("anfrage_id", anfrageId)
    .eq("status", "open")
    .maybeSingle();

  if (conversationError || !conversation) return { error: "CONVERSATION_NOT_FOUND" };
  if (conversation.alias_revoked_at) return { error: "CONVERSATION_ALIAS_REVOKED" };
  if (String(conversation.therapist_id) !== String(anfrage.assigned_therapist_id)) return { error: "ASSIGNMENT_MISMATCH" };

  const { data: coach, error: coachError } = await supabase
    .from("team_members")
    .select("id, email, active, role")
    .eq("id", conversation.therapist_id)
    .single();

  if (coachError || !coach || coach.active !== true || coach.role !== "therapist") return { error: "COACH_UNAVAILABLE" };
  if (!isValidRecipient(coach.email)) return { error: "RECIPIENT_UNAVAILABLE" };

  const messageSubject = subject || "Nachricht von Klient:in";

  const { data: queuedMessage, error: insertError } = await supabase
    .from("request_messages")
    .insert({
      conversation_id: conversation.id,
      anfrage_id: anfrage.id,
      direction: "inbound",
      sender_role: "client",
      delivery_status: "received",
      client_request_id: clientRequestId,
      subject: messageSubject,
      text_body: text,
    })
    .select("id, delivery_status")
    .single();

  if (insertError) {
    if (insertError.code === "23505" && clientRequestId) {
      const existingMessage = await findExistingMessage(
        supabase,
        conversation.id,
        clientRequestId
      );
      if (existingMessage) return { ok: true, message: existingMessage, duplicate: true };
    }
    return { error: "MESSAGE_QUEUE_FAILED" };
  }

  try {
    const result = await sendOutboundMail({
      from: getMessagingFrom(),
      to: coach.email,
      reply_to: conversation.reply_alias,
      subject: `Nachricht von Klient:in: ${messageSubject}`,
      text: `Nachricht von Klient:in:\n\n${text}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><p><strong>Nachricht von Klient:in</strong></p><div style="white-space:pre-line">${escapeHtml(text)}</div></div>`,
      headers: { [FORWARD_HEADER]: FORWARD_VALUE },
    }, resendClient);

    if (result?.error) throw new Error("RESEND_SEND_FAILED");

    const { data: sentMessage, error: sentUpdateError } = await supabase
      .from("request_messages")
      .update({
        delivery_status: "forwarded",
        provider_message_id: result?.data?.id || null,
      })
      .eq("id", queuedMessage.id)
      .select("id, delivery_status, created_at")
      .single();

    if (sentUpdateError || !sentMessage) return { error: "MESSAGE_STATUS_UPDATE_FAILED" };
    return { ok: true, message: sentMessage };
  } catch {
    await supabase
      .from("request_messages")
      .update({ delivery_status: "failed" })
      .eq("id", queuedMessage.id);

    return { error: "MESSAGE_SEND_FAILED" };
  }
}