export const dynamic = "force-dynamic";

import { json, supabaseAdmin } from "../../_lib/server";
import { processInboundResendEvent, verifyResendWebhook } from "../../../lib/messaging/inbound";

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

    return json({ ok: true });
  } catch {
    return json({ error: "WEBHOOK_UNAVAILABLE" }, 500);
  }
}