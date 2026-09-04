export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { sendClientMessage } from "../../../lib/messaging/outbound";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isNonEmptyText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }

    const { token, text } = body || {};
    const clientRequestId = request.headers.get("idempotency-key") || null;

    if (!isNonEmptyText(token, 500) || !isNonEmptyText(text, 10000)) {
      return json({ error: "INVALID_MESSAGE" }, 400);
    }

    if (clientRequestId && !isUuid(clientRequestId)) {
      return json({ error: "INVALID_IDEMPOTENCY_KEY" }, 400);
    }

    const { data: anfrage, error: requestError } = await supabase
      .from("anfragen")
      .select("id")
      .eq("booking_token", token)
      .single();

    if (requestError || !anfrage) {
      return json({ error: "INVALID_TOKEN" }, 404);
    }

    const result = await sendClientMessage({
      supabase,
      resendClient: new Resend(process.env.RESEND_API_KEY),
      anfrageId: anfrage.id,
      subject: "Rückmeldung zu Terminvorschlägen",
      text: text.trim(),
      clientRequestId,
    });

    if (!result.ok) {
      const status = ["ASSIGNMENT_MISMATCH"].includes(result.error)
        ? 403
        : ["REQUEST_NOT_FOUND", "CONVERSATION_NOT_FOUND"].includes(result.error)
          ? 404
          : result.error === "RECIPIENT_UNAVAILABLE"
            ? 422
            : 409;
      return json({ error: result.error }, status);
    }

    return json({ ok: true, message: result.message, duplicate: result.duplicate === true });
  } catch {
    return json({ error: "PROPOSAL_MESSAGE_UNAVAILABLE" }, 500);
  }
}