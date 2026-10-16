export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import {
  HEALTH_DATA_CONSENT_VERSION,
  findActiveHealthDataConsent,
  hashHealthDataConsentToken,
  newHealthDataConsentToken,
} from "../../lib/healthDataConsent.js";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key) : null;
}

async function authorizeRequest(supabase, requestId, bookingToken) {
  if (!requestId || typeof bookingToken !== "string" || !bookingToken.trim()) {
    return false;
  }

  const { data, error } = await supabase
    .from("anfragen")
    .select("id")
    .eq("id", requestId)
    .eq("booking_token", bookingToken)
    .maybeSingle();

  if (error) throw new Error("HEALTH_DATA_CONSENT_REQUEST_LOOKUP_FAILED");
  return Boolean(data);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const supabase = getSupabase();
    if (!supabase) return json({ error: "SUPABASE_NOT_CONFIGURED" }, 500);

    if (body.action === "grant") {
      const requestId = body.requestId || null;
      if (
        requestId &&
        !(await authorizeRequest(supabase, requestId, body.booking_token))
      ) {
        return json({ error: "REQUEST_NOT_FOUND" }, 404);
      }

      const token = newHealthDataConsentToken();
      const { data, error } = await supabase
        .from("anfrage_health_data_consents")
        .insert({
          request_id: requestId,
          token_hash: hashHealthDataConsentToken(token),
          text_version: HEALTH_DATA_CONSENT_VERSION,
        })
        .select("id")
        .single();

      if (error || !data) {
        console.error("HEALTH_DATA_CONSENT_GRANT_FAILED");
        return json({ error: "CONSENT_UNAVAILABLE" }, 503);
      }

      if (requestId) {
        const now = new Date().toISOString();
        const { error: revokeError } = await supabase
          .from("anfrage_health_data_consents")
          .update({ revoked_at: now })
          .eq("request_id", requestId)
          .neq("id", data.id)
          .is("revoked_at", null);
        if (revokeError) {
          await supabase
            .from("anfrage_health_data_consents")
            .update({ revoked_at: now })
            .eq("id", data.id)
            .is("revoked_at", null);
          console.error("HEALTH_DATA_CONSENT_SUPERSEDE_FAILED");
          return json({ error: "CONSENT_UNAVAILABLE" }, 503);
        }
      }

      return json({ consentToken: token, version: HEALTH_DATA_CONSENT_VERSION });
    }

    if (body.action === "revoke") {
      const consent = await findActiveHealthDataConsent(
        supabase,
        body.consentToken
      );
      if (!consent) return json({ error: "CONSENT_NOT_FOUND" }, 404);

      if (
        consent.request_id &&
        !(await authorizeRequest(supabase, consent.request_id, body.booking_token))
      ) {
        return json({ error: "REQUEST_NOT_FOUND" }, 404);
      }
      if (body.requestId && body.requestId !== consent.request_id) {
        return json({ error: "CONSENT_NOT_FOUND" }, 404);
      }

      const { error } = await supabase
        .from("anfrage_health_data_consents")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", consent.id)
        .is("revoked_at", null);
      if (error) {
        console.error("HEALTH_DATA_CONSENT_REVOKE_FAILED");
        return json({ error: "CONSENT_UNAVAILABLE" }, 503);
      }

      return json({ ok: true });
    }

    return json({ error: "INVALID_ACTION" }, 400);
  } catch {
    console.error("HEALTH_DATA_CONSENT_UNAVAILABLE");
    return json({ error: "CONSENT_UNAVAILABLE" }, 503);
  }
}
