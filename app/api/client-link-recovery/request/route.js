export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  RECOVERY_MESSAGE, RECOVERY_PURPOSES, newRecoverySecret,
  recoveryHash, recoveryOrigin, recoveryRateKey,
} from "../../../lib/clientLinkRecovery.js";

export async function POST(req) {
  const generic = () => Response.json({ ok: true, message: RECOVERY_MESSAGE }, {
    status: 202,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!RECOVERY_PURPOSES.includes(body.purpose) || email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return generic();
    if (body.requestId && (typeof body.requestId !== "string" || body.requestId.length > 100)) return generic();
    if (body.legacyProposal && (typeof body.legacyProposal !== "string" || body.legacyProposal.length > 100)) return generic();

    const secret = newRecoverySecret();
    const origin = recoveryOrigin();
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    // Vercel supplies this header; ignore client-supplied forwarded-for chains.
    // Without a trusted edge IP, all callers share a conservative fallback bucket.
    const source = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { data, error } = await supabase.rpc("issue_client_link_recovery", {
      p_email: email,
      p_request_id: body.requestId || null,
      p_legacy_proposal: body.legacyProposal || null,
      p_purpose: body.purpose,
      p_secret_hash: recoveryHash(secret),
      p_email_key: recoveryRateKey(`email:${email}`),
      p_source_key: recoveryRateKey(`source:${source}`),
    });
    if (error) {
      console.error("CLIENT_LINK_RECOVERY_UNAVAILABLE");
      return generic();
    }
    const recipient = data?.[0]?.recipient;
    if (!recipient) return generic();
    const link = `${origin}/recover-link#${secret}`;
    const { error: mailError } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: "Poise <noreply@mypoise.de>",
      to: recipient,
      subject: "Dein angeforderter Zugang zu Poise",
      text: `Du hast einen neuen Zugang angefordert.\n\nÖffne diesen Link und bestätige dort, dass du fortfahren möchtest:\n${link}\n\nDer Link ist 15 Minuten gültig und kann einmal verwendet werden. Wenn du dies nicht angefordert hast, ignoriere diese E-Mail.`,
    });
    if (mailError) console.error("CLIENT_LINK_RECOVERY_MAIL_FAILED");
  } catch {
    console.error("CLIENT_LINK_RECOVERY_UNAVAILABLE");
  }
  return generic();
}
