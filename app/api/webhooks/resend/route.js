export const dynamic = "force-dynamic";

import { json, supabaseAdmin } from "../../_lib/server";
import { processInboundResendEvent, verifyResendWebhook } from "../../../lib/messaging/inbound";
import { messagingErrorStatus } from "../../../lib/messaging/access";

export async function POST(request) {
  const rawBody = await request.text();
  const providerEventId = request.headers.get("svix-id");

  let event;
  try {
    event = verifyResendWebhook({
      rawBody,
      headers: request.headers,
      secret: process.env.RESEND_WEBHOOK_SECRET,
    });
  } catch {
    return json({ error: "INVALID_WEBHOOK_SIGNATURE" }, 400);
  }

  try {
    const result = await processInboundResendEvent({
      supabase: supabaseAdmin(),
      event,
      providerEventId,
    });

    if (result?.error === "EVENT_ID_MISSING") {
      return json({ error: "EVENT_ID_MISSING" }, 400);
    }
    if (result?.error) {
      return json(
        { error: result.error },
        messagingErrorStatus(result.error) || 503
      );
    }

    return json({ ok: true });
  } catch {
    return json({ error: "WEBHOOK_UNAVAILABLE" }, 500);
  }
}