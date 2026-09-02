export const dynamic = "force-dynamic";

import { json, supabaseAdmin } from "../../_lib/server";
import { processInboundResendEvent, verifyResendWebhook } from "../../../lib/messaging/inbound";

export async function POST(request) {
  const rawBody = await request.text();

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
    await processInboundResendEvent({
      supabase: supabaseAdmin(),
      event,
    });
    return json({ ok: true });
  } catch {
    return json({ error: "WEBHOOK_UNAVAILABLE" }, 500);
  }
}