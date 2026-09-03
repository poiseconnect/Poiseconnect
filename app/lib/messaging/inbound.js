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

function getEventId(event, providerEventId = null) {
  return providerEventId || event?.id || event?.data?.event_id || null;
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

function getHeaderValue(headers, name) {
  if (!headers) return null;
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  if (!key) return null;
  const value = headers[key];
  return Array.isArray(value) ? value.join(" ") : value;
}

function isAutoReply(email) {
  const headers = email?.headers || {};
  const autoSubmitted = getHeaderValue(headers, "auto-submitted");
  if (autoSubmitted && autoSubmitted.trim().toLowerCase() !== "no") return true;

  const precedence = getHeaderValue(headers, "precedence");
  if (precedence && ["bulk", "list", "junk", "auto_reply", "auto-reply"].includes(precedence.trim().toLowerCase())) return true;

  if (getHeaderValue(headers, "x-autoreply")) return true;
  if (getHeaderValue(headers, "x-autorespond")) return true;
  return false;
}

function getDomain(address) {
  const normalized = normalizeAddress(address);
  if (!normalized) return null;
  const at = normalized.lastIndexOf("@");
  return at === -1 ? null : normalized.slice(at + 1);
}

function domainMatches(candidate, expected) {
  if (!candidate || !expected) return false;
  if (candidate === expected) return true;
  return candidate.endsWith(`.${expected}`) || expected.endsWith(`.${candidate}`);
}

// RFC 8601 Authentication-Results ist die einzige providerunabhängige Auth-Quelle.
function parseAuthenticationResults(value) {
  const text = String(value || "");
  const dkimResult = text.match(/\bdkim=(\w+)/i);
  const dkimDomain = text.match(/header\.d=([^\s;]+)/i) || text.match(/header\.i=(?:[^@\s;]*@)?([^\s;]+)/i);
  const spfResult = text.match(/\bspf=(\w+)/i);
  const spfDomain = text.match(/smtp\.mailfrom=(?:[^@\s;]*@)?([^\s;]+)/i) || text.match(/header\.from=([^\s;]+)/i);

  return {
    dkim: dkimResult ? dkimResult[1].toLowerCase() : null,
    dkimDomain: dkimDomain ? dkimDomain[1].toLowerCase() : null,
    spf: spfResult ? spfResult[1].toLowerCase() : null,
    spfDomain: spfDomain ? spfDomain[1].toLowerCase() : null,
  };
}

// Fail-closed: fehlende Authentication-Results gelten als nicht authentifiziert.
function isSenderAuthenticated(email) {
  const authHeader = getHeaderValue(email?.headers, "authentication-results");
  if (!authHeader) return false;

  const { dkim, dkimDomain, spf, spfDomain } = parseAuthenticationResults(authHeader);
  const fromDomain = getDomain(email?.from);
  if (!fromDomain) return false;

  if (dkim === "pass" && domainMatches(dkimDomain, fromDomain)) return true;
  if (spf === "pass" && domainMatches(spfDomain, fromDomain)) return true;
  return false;
}

function isValidRecipient(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

const KNOWN_PROCESSING_ERROR_PREFIXES = [
  "RECEIVED_EMAIL_FETCH_FAILED_",
  "INBOUND_MESSAGE_PERSIST_FAILED",
  "COACH_REPLY_SEND_FAILED",
  "FORWARD_FAILED",
  "EVENT_LEDGER_FAILED",
];

// Nur bekannte, statische Fehlerklassen dürfen als processing_error gespeichert werden.
function getSafeProcessingError(err) {
  const message = String(err?.message || "");
  const isKnown = KNOWN_PROCESSING_ERROR_PREFIXES.some((prefix) => message.startsWith(prefix));
  return isKnown ? message : "INBOUND_PROCESSING_FAILED";
}

export function verifyResendWebhook({ rawBody, headers, secret }) {
  if (!secret) throw new Error("WEBHOOK_SECRET_MISSING");

  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) throw new Error("WEBHOOK_SIGNATURE_MISSING");

  new Webhook(secret).verify(rawBody, {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": svixSignature,
  });

  // svix.verify() bestätigt nur die Signatur und gibt kein Payload zurück.
  return JSON.parse(rawBody);
}

export async function fetchReceivedEmail(emailId, fetchImpl = fetch) {
  const response = await fetchImpl(`${RESEND_EMAILS_URL}/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`RECEIVED_EMAIL_FETCH_FAILED_${response.status}`);
  return response.json();
}

async function createEvent(supabase, event, eventId) {
  const { data, error } = await supabase
    .from("request_message_events")
    .insert({
      provider: "resend",
      provider_event_id: eventId,
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

// Erneut zugestelltes Provider-Event darf eine failed Message erneut versuchen, aber nie eine zweite Zeile anlegen.
async function retryFailedMessage({ supabase, resendClient, message }) {
  if (message.direction === "outbound" && message.sender_role === "coach") {
    const { data: anfrage } = await supabase
      .from("anfragen")
      .select("id, email")
      .eq("id", message.anfrage_id)
      .single();

    if (!anfrage || !isValidRecipient(anfrage.email)) {
      return { ok: true, failed: true };
    }

    try {
      const sendResult = await sendOutboundMail({
        from: getMessagingFrom(),
        to: anfrage.email,
        replyTo: message.received_to_alias,
        subject: message.subject || "",
        text: message.text_body || "",
        html: message.html_body || undefined,
      }, resendClient);

      if (sendResult?.error) throw new Error("RETRY_SEND_FAILED");
      await markMessage(supabase, message.id, "sent");
      return { ok: true, sent: true };
    } catch {
      await markMessage(supabase, message.id, "failed");
      return { ok: true, failed: true };
    }
  }

  if (message.direction === "inbound" && message.sender_role === "client") {
    const { data: conversation } = await supabase
      .from("request_conversations")
      .select("id, anfrage_id, therapist_id, status, alias_revoked_at")
      .eq("id", message.conversation_id)
      .maybeSingle();

    if (!conversation || conversation.status !== "open" || conversation.alias_revoked_at) {
      return { ok: true, failed: true };
    }

    const { data: anfrage } = await supabase
      .from("anfragen")
      .select("id, assigned_therapist_id")
      .eq("id", conversation.anfrage_id)
      .single();
    const { data: coach } = await supabase
      .from("team_members")
      .select("id, email, active, role")
      .eq("id", conversation.therapist_id)
      .single();

    if (!anfrage || !coach || coach.active !== true || coach.role !== "therapist" || String(anfrage.assigned_therapist_id) !== String(conversation.therapist_id) || !normalizeAddress(coach.email)) {
      return { ok: true, failed: true };
    }

    try {
      const forwardResult = await sendOutboundMail({
        from: getMessagingFrom(),
        to: coach.email,
        replyTo: message.received_to_alias,
        subject: message.subject || "",
        text: message.text_body || "",
        html: message.html_body || undefined,
        headers: { [FORWARD_HEADER]: FORWARD_VALUE },
      }, resendClient);

      if (forwardResult?.error) throw new Error("RETRY_FORWARD_FAILED");
      await markMessage(supabase, message.id, "forwarded");
      return { ok: true, forwarded: true };
    } catch {
      await markMessage(supabase, message.id, "failed");
      return { ok: true, failed: true };
    }
  }

  return { ok: true, duplicate: true };
}

// Derselbe Provider-Event-Retry darf eine vorhandene failed Message erneut zustellen, niemals eine zweite Zeile anlegen.
async function handleDuplicateEvent({ supabase, resendClient, event }) {
  const providerEmailId = getProviderEmailId(event);
  if (!providerEmailId) return { ok: true, duplicate: true };

  const { data: existingMessage, error } = await supabase
    .from("request_messages")
    .select("id, conversation_id, anfrage_id, direction, sender_role, delivery_status, subject, text_body, html_body, received_to_alias")
    .eq("provider_email_id", providerEmailId)
    .maybeSingle();

  if (error || !existingMessage || existingMessage.delivery_status !== "failed") {
    return { ok: true, duplicate: true };
  }

  return retryFailedMessage({ supabase, resendClient, message: existingMessage });
}

export async function processInboundResendEvent({ supabase, event, providerEventId, fetchImpl, resendClient }) {
  const eventId = getEventId(event, providerEventId);
  if (!eventId) return { error: "EVENT_ID_MISSING" };

  const ledger = await createEvent(supabase, event, eventId);
  if (ledger.duplicate) return handleDuplicateEvent({ supabase, resendClient, event });
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

    let unsafeReason = null;
    if (hasForwardLoopMarker(email)) unsafeReason = "LOOP_MARKER_DETECTED";
    else if (hasOwnSender(email)) unsafeReason = "OWN_SENDER_DETECTED";
    else if (isAutoReply(email)) unsafeReason = "AUTO_REPLY_DETECTED";
    else if (parsedAliases.length !== 1) unsafeReason = "ALIAS_AMBIGUOUS";

    if (unsafeReason) {
      await persistReviewMessage({
        supabase,
        email,
        providerEmailId,
        providerEventId: eventId,
        replyAlias: parsedAliases[0]?.replyAlias || null,
      });
      await completeEvent(supabase, ledger.eventId, unsafeReason);
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
      .select("id, email, assigned_therapist_id")
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
      if (!isSenderAuthenticated(email)) {
        await persistReviewMessage({
          supabase,
          email,
          providerEmailId,
          providerEventId: eventId,
          replyAlias,
          conversation,
          anfrageId: conversation.anfrage_id,
        });
        await completeEvent(supabase, ledger.eventId, "COACH_AUTH_UNVERIFIED");
        return { ok: true, review: true };
      }

      if (!isValidRecipient(anfrage.email)) {
        await persistReviewMessage({
          supabase,
          email,
          providerEmailId,
          providerEventId: eventId,
          replyAlias,
          conversation,
          anfrageId: conversation.anfrage_id,
        });
        await completeEvent(supabase, ledger.eventId, "CLIENT_EMAIL_UNAVAILABLE");
        return { ok: true, review: true };
      }

      const persistedCoachReply = await persistInboundMessage(supabase, {
        conversation_id: conversation.id,
        anfrage_id: conversation.anfrage_id,
        direction: "outbound",
        sender_role: "coach",
        delivery_status: "queued",
        provider_message_id: providerEmailId,
        provider_email_id: providerEmailId,
        provider_event_id: eventId,
        subject: String(email?.subject || "").slice(0, 200),
        text_body: String(email?.text || ""),
        html_body: email?.html || null,
        received_to_alias: replyAlias,
      });

      if (persistedCoachReply.duplicate) {
        await completeEvent(supabase, ledger.eventId);
        return { ok: true, duplicate: true };
      }

      try {
        const sendResult = await sendOutboundMail({
          from: getMessagingFrom(),
          to: anfrage.email,
          replyTo: replyAlias,
          subject: String(email?.subject || "").slice(0, 200),
          text: String(email?.text || ""),
          html: email?.html || undefined,
        }, resendClient);

        if (sendResult?.error) throw new Error("COACH_REPLY_SEND_FAILED");
        await markMessage(supabase, persistedCoachReply.messageId, "sent");
        await completeEvent(supabase, ledger.eventId);
        return { ok: true, sent: true };
      } catch {
        await markMessage(supabase, persistedCoachReply.messageId, "failed");
        await completeEvent(supabase, ledger.eventId, "COACH_REPLY_SEND_FAILED");
        return { ok: true, failed: true };
      }
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
  } catch (err) {
    await completeEvent(supabase, ledger.eventId, getSafeProcessingError(err));
    return { ok: true, failed: true };
  }
}