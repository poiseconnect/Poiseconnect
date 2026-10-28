export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import {
  HEALTH_DATA_CONSENT_VERSION,
  hashHealthDataConsentToken,
  newHealthDataConsentToken,
} from "../../lib/healthDataConsent.js";
import { HEALTH_DATA_RECIPIENT_NOTICE_VERSION } from "../../lib/healthDataConsentShared.js";

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

export async function POST(req) {
  try {
    const body = await req.json();
    const supabase = getSupabase();
    if (!supabase) return json({ error: "SUPABASE_NOT_CONFIGURED" }, 500);

    if (body.action === "authorize-recipient") {
      if (body.accepted !== true ||
          body.noticeVersion !== HEALTH_DATA_RECIPIENT_NOTICE_VERSION ||
          typeof body.coachId !== "string" ||
          typeof body.consentToken !== "string" ||
          !/^[a-f0-9]{64}$/.test(body.consentToken) ||
          (body.requestId && (!Number.isSafeInteger(body.expectedCareVersion) ||
            body.expectedCareVersion < 0))) {
        return json({ error: "RECIPIENT_CONSENT_REQUIRED" }, 400);
      }
      const { data, error } = await supabase.rpc("privacy_authorize_recipient", {
        p_request_id: body.requestId || null,
        p_booking_token: body.booking_token || null,
        p_consent_hash: hashHealthDataConsentToken(body.consentToken),
        p_coach_id: body.coachId,
        p_expected_version: body.expectedCareVersion ?? null,
        p_notice_version: HEALTH_DATA_RECIPIENT_NOTICE_VERSION,
      });
      if (error || data !== true) {
        const code = error?.message;
        const conflicts = ["CARE_VERSION_CONFLICT", "COACH_NOT_APPROVED",
          "INTAKE_RECIPIENT_CHANGE_REQUIRES_APPROVAL", "FUTURE_APPOINTMENTS_REQUIRE_DECISION",
          "CARE_OPERATION_IN_PROGRESS", "HEALTH_DATA_CONSENT_REQUIRED"];
        console.error("RECIPIENT_CONSENT_UNAVAILABLE", { code: error?.code || null });
        return json({ error: conflicts.includes(code) ? code : "CONSENT_UNAVAILABLE" },
          conflicts.includes(code) ? 409 : 503);
      }
      return json({ ok: true });
    }

    if (body.action === "grant") {
      const requestId = body.requestId || null;
      const token = newHealthDataConsentToken();
      const { data, error } = await supabase.rpc("privacy_grant_intake_consent", {
        p_request_id: requestId,
        p_booking_token: body.booking_token || null,
        p_token_hash: hashHealthDataConsentToken(token),
      });

      if (error || !data) {
        console.error("HEALTH_DATA_CONSENT_GRANT_FAILED");
        if (error?.message === "REQUEST_NOT_FOUND") {
          return json({ error: "REQUEST_NOT_FOUND" }, 404);
        }
        return json({ error: "CONSENT_UNAVAILABLE" }, 503);
      }

      return json({ consentToken: token, version: HEALTH_DATA_CONSENT_VERSION });
    }

    if (body.action === "revoke") {
      if (typeof body.consentToken !== "string" || !/^[a-f0-9]{64}$/.test(body.consentToken)) {
        return json({ error: "CONSENT_NOT_FOUND" }, 404);
      }
      const { data, error } = await supabase.rpc("privacy_revoke_intake_consent", {
        p_request_id: body.requestId || null,
        p_booking_token: body.booking_token || null,
        p_token_hash: hashHealthDataConsentToken(body.consentToken),
      });
      if (error) {
        console.error("HEALTH_DATA_CONSENT_REVOKE_FAILED");
        return json({ error: "CONSENT_UNAVAILABLE" }, 503);
      }

      if (!data) return json({ error: "CONSENT_NOT_FOUND" }, 404);
      return json({ ok: true });
    }

    return json({ error: "INVALID_ACTION" }, 400);
  } catch {
    console.error("HEALTH_DATA_CONSENT_UNAVAILABLE");
    return json({ error: "CONSENT_UNAVAILABLE" }, 503);
  }
}
