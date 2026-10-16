export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import {
  RECOVERY_MESSAGE, RECOVERY_PURPOSES, newRecoverySecret,
  encryptRecoverySecret, recoveryHash, recoveryRateKey,
} from "../../../lib/clientLinkRecovery.js";

export async function POST(req) {
  const generic = (status = 202) => Response.json({
    ok: status === 202,
    message: RECOVERY_MESSAGE,
  }, {
    status,
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
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    // Vercel supplies this header; ignore client-supplied forwarded-for chains.
    // Without a trusted edge IP, all callers share a conservative fallback bucket.
    const source = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { error } = await supabase.rpc("enqueue_client_link_recovery", {
      p_email: email,
      p_request_id: body.requestId || null,
      p_legacy_proposal: body.legacyProposal || null,
      p_purpose: body.purpose,
      p_secret_hash: recoveryHash(secret),
      p_encrypted_secret: encryptRecoverySecret(secret),
      p_email_key: recoveryRateKey(`email:${email}`),
      p_source_key: recoveryRateKey(`source:${source}`),
    });
    if (error) {
      console.error("CLIENT_LINK_RECOVERY_UNAVAILABLE");
      return generic(503);
    }
  } catch {
    console.error("CLIENT_LINK_RECOVERY_UNAVAILABLE");
    return generic(503);
  }
  return generic();
}
