import { Webhook } from "svix";
import { hashReplyToken, parseReplyAlias } from "./aliases";
import { getMessagingFrom, sendOutboundMail } from "./outbound";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const FORWARD_HEADER = "X-Poise-Messaging";
const FORWARD_VALUE = "inbound-forward-v1";

function normalizeAddress(value) {
  const match = String(value || "").match(/<?([^<>\s]+@[^<>\s]+)>?/);
  return match ? match[1].trim().toLowerCase() : null;
}

function getRecipientAddresses(email) {
  const rawRecipients = email?.to || email?.recipients || email?.headers?.to || [];
  const recipients = Array.isArray(rawRecipients) ? rawRecipients : [rawRecipients];
  return recipients.map(normalizeAddress).filter(Boolean);
}

function getProviderEmailId(event) {
  return event?.data?.email_id || event?.data?.email?.id || event?.data?.id || null;
}

function getEventId(event) {
  return event?.id || event?.data?.event_id || null;
}

function hasForwardLoopMarker(email) {
  const headers = email?.headers || {};
  return Object.entries(headers).some(([name, value]) =>
    String(name).toLowerCase() === FORWARD_HEADER.toLowerCase() && String(value).toLowerCase() === FORWARD_VALUE
  );
}

function hasOwnSender(email) {
  const from = normalizeAddress(email?.from);
  const messagingFrom = normalizeAddress(getMessagingFrom());
  return Boolean(from && messagingFrom && from === messagingFrom);
}

export function verifyResendWebhook({ rawBody, headers, secret }) {
  if (!secret) throw new Error("WEBHOOK_SECRET_MISSING");

  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) throw new Error("WEBHOOK_SIGNATURE_MISSING");

  return new Webhook(secret).verify(rawBody, {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": svixSignature,
  });
}

export async function fetchReceivedEmail(emailId, fetchImpl = fetch) {
  const response = await fetchImpl(`${RESEND_EMAILS_URL}/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    cache: "no-store",
  });

  if (!response.ok) throw new Error("RECEIVED_EMAIL_FETCH_FAILED");
  return response.json();
}

async function createEvent(supabase, event) {
  const { data, error } = await supabase
    .from("request_message_events")
    .insert({
      provider: "resend",
      provider_event_id: getEventId(event),
      event_type: String(event?.type || "unknown"),
    })
    .select("id")
    .single();

  if (error?.code === "23505") return { duplicate: true };
  if (error || !data) throw new Error("EVENT_LEDGER_FAILED");
  return { eventId: data.id };
}

async function completeEvent(supabase, eventId, processingError = null) {
  await supabase
    .from("request_message_events")
    .update({ processed_at: new Date().toISOString(), processing_error: processingError })
    .eq("id", eventId);
}

async function persistInboundMessage(supabase, payload) {
  const { data, error } = await supabase
    .from("request_messages")
    .insert(payload)
    .select("id")
    .single();

  if (error?.code === "23505") return { duplicate: true };
  if (error || !data) throw new Error("INBOUND_MESSAGE_PERSIST_FAILED");
  return { messageId: data.id };
}

async function markMessage(supabase, messageId, deliveryStatus) {
  await supabase
    .from("request_messages")
    .update({ delivery_status: deliveryStatus })
    .eq("id", messageId);
}

async function persistReviewMessage({ supabase, email, providerEmailId, providerEventId, replyAlias, conversation, anfrageId }) {
  await persistInboundMessage(supabase, {
    conversation_id: conversation?.id || null,
    anfrage_id: anfrageId || null,
    direction: "inbound",
    sender_role: "client",
    delivery_status: "review",
    provider_message_id: providerEmailId,
    provider_email_id: providerEmailId,
    provider_event_id: providerEventId,
    subject: String(email?.subject || "").slice(0, 200),
    text_body: String(email?.text || ""),
    html_body: email?.html || null,
    received_to_alias: replyAlias || null,
  });
}

export async function processInboundResendEvent({ supabase, event, fetchImpl, resendClient }) {
  const eventId = getEventId(event);
  if (!eventId) return { error: "EVENT_ID_MISSING" };

  const ledger = await createEvent(supabase, event);
  if (ledger.duplicate) return { ok: true, duplicate: true };
  if (event?.type !== "email.received") {
    await completeEvent(supabase, ledger.eventId);
    return { ok: true, ignored: true };
  }

  const providerEmailId = getProviderEmailId(event);
  if (!providerEmailId) {
    await completeEvent(supabase, ledger.eventId, "EMAIL_ID_MISSING");
    return { ok: true, review: true };
  }

  try {
    const email = await fetchReceivedEmail(providerEmailId, fetchImpl);
    const recipients = getRecipientAddresses(email);
    const parsedAliases = recipients
      .map((recipient) => parseReplyAlias(recipient))
      .filter(Boolean);

    if (hasForwardLoopMarker(email) || hasOwnSender(email) || parsedAliases.length !== 1) {
      await persistReviewMessage({
        supabase,
        email,
        providerEmailId,
        providerEventId: eventId,
        replyAlias: parsedAliases[0]?.replyAlias || null,
      });
      await completeEvent(supabase, ledger.eventId, "UNSAFE_INBOUND_MESSAGE");
      return { ok: true, review: true };
    }

    const { replyAlias, replyToken } = parsedAliases[0];
    const { data: conversation, error: conversationError } = await supabase
      .from("request_conversations")
      .select("id, anfrage_id, therapist_id, status, alias_revoked_at")
      .eq("reply_token_hash", hashReplyToken(replyToken))
      .maybeSingle();

    if (conversationError || !conversation || conversation.status !== "open" || conversation.alias_revoked_at) {
      await persistReviewMessage({
        supabase,
        email,
        providerEmailId,
        providerEventId: eventId,
        replyAlias,
        conversation: conversation || null,
        anfrageId: conversation?.anfrage_id || null,
      });
      await completeEvent(supabase, ledger.eventId, "CONVERSATION_NOT_DELIVERABLE");
      return { ok: true, review: true };
    }

    const { data: anfrage, error: requestError } = await supabase
      .from("anfragen")
      .select("id, assigned_therapist_id")
      .eq("id", conversation.anfrage_id)
      .single();
    const { data: coach, error: coachError } = await supabase
      .from("team_members")
      .select("id, email, active, role")
      .eq("id", conversation.therapist_id)
      .single();

    if (requestError || coachError || !anfrage || !coach || coach.active !== true || coach.role !== "therapist" || String(anfrage.assigned_therapist_id) !== String(conversation.therapist_id)) {
      await persistReviewMessage({
        supabase,
        email,
        providerEmailId,
        providerEventId: eventId,
        replyAlias,
        conversation,
        anfrageId: conversation.anfrage_id,
      });
      await completeEvent(supabase, ledger.eventId, "ASSIGNMENT_NOT_DELIVERABLE");
      return { ok: true, review: true };
    }

    if (normalizeAddress(email?.from) === normalizeAddress(coach.email)) {
      await persistReviewMessage({
        supabase,
        email,
        providerEmailId,
        providerEventId: eventId,
        replyAlias,
        conversation,
        anfrageId: conversation.anfrage_id,
      });
      await completeEvent(supabase, ledger.eventId, "COACH_REPLY_REQUIRES_OUTBOUND_FLOW");
      return { ok: true, review: true };
    }

    const persisted = await persistInboundMessage(supabase, {
      conversation_id: conversation.id,
      anfrage_id: conversation.anfrage_id,
      direction: "inbound",
      sender_role: "client",
      delivery_status: "received",
      provider_message_id: providerEmailId,
      provider_email_id: providerEmailId,
      provider_event_id: eventId,
      subject: String(email?.subject || "").slice(0, 200),
      text_body: String(email?.text || ""),
      html_body: email?.html || null,
      received_to_alias: replyAlias,
    });

    if (persisted.duplicate) {
      await completeEvent(supabase, ledger.eventId);
      return { ok: true, duplicate: true };
    }

    if (!normalizeAddress(coach.email)) {
      await markMessage(supabase, persisted.messageId, "failed");
      await completeEvent(supabase, ledger.eventId, "COACH_EMAIL_UNAVAILABLE");
      return { ok: true, review: true };
    }

    try {
      const forwardResult = await sendOutboundMail({
        from: getMessagingFrom(),
        to: coach.email,
        replyTo: replyAlias,
        subject: `Nachricht von Klient:in: ${String(email?.subject || "").slice(0, 160)}`,
        text: `Nachricht von Klient:in:\n\n${String(email?.text || "")}`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><p><strong>Nachricht von Klient:in</strong></p><div style="white-space:pre-line">${String(email?.text || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</div></div>`,
        headers: { [FORWARD_HEADER]: FORWARD_VALUE },
      }, resendClient);

      if (forwardResult?.error) throw new Error("FORWARD_FAILED");
      await markMessage(supabase, persisted.messageId, "forwarded");
      await completeEvent(supabase, ledger.eventId);
      return { ok: true, forwarded: true };
    } catch {
      await markMessage(supabase, persisted.messageId, "failed");
      await completeEvent(supabase, ledger.eventId, "FORWARD_FAILED");
      return { ok: true, failed: true };
    }
  } catch {
    await completeEvent(supabase, ledger.eventId, "INBOUND_PROCESSING_FAILED");
    return { ok: true, failed: true };
  }
}