export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { buildDraftRecoveryFields } from "../../lib/draftRecovery.js";
import {
  findActiveHealthDataConsent,
} from "../../lib/healthDataConsent.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();

const {
  anfrageId,
  booking_token,
  wunschtherapeut,
  assigned_therapist_id,
  coaching_typ,

  vorname,
  nachname,
  email,
  telefon,
  strasse_hausnr,
  plz_ort,
  geburtsdatum,
  beschaeftigungsgrad,

  structured_time_preference,
  draft_recovery_consent,
  draft_current_step,
  intakeConsentToken,
} = body || {};

    const consent = await findActiveHealthDataConsent(
      supabase,
      intakeConsentToken,
      anfrageId
        ? { requestId: anfrageId }
        : { requestId: null }
    );
    if (!consent) {
      return json({ error: "HEALTH_DATA_CONSENT_REQUIRED" }, 403);
    }

    if (anfrageId) {
      if (typeof booking_token !== "string" || !booking_token.trim()) {
        return json({ error: "RECOVERY_REQUIRED" }, 401);
      }
      const { data: existingRequest, error: loadError } = await supabase
        .from("anfragen")
        .select("status")
        .eq("id", anfrageId)
        .eq("booking_token", booking_token)
        .maybeSingle();

      if (loadError) {
        console.error("DRAFT LOAD ERROR:", {
          requestId: anfrageId,
          code: loadError?.code || null,
        });
        return json({ error: "DRAFT_LOAD_FAILED" }, 500);
      }

      if (!existingRequest) {
        return json({ error: "REQUEST_NOT_FOUND" }, 404);
      }

      if (existingRequest.status !== "draft") {
        console.warn("DRAFT UPDATE CONFLICT", {
          route: "/api/create-request-draft",
          requestId: anfrageId,
          currentStatus: existingRequest.status,
          code: "REQUEST_ALREADY_FINALIZED",
        });
        return json({ error: "REQUEST_ALREADY_FINALIZED" }, 409);
      }
    }

    if (!assigned_therapist_id) {
      return json({ error: "ASSIGNED_THERAPIST_ID_MISSING" }, 400);
    }

const payload = {
  vorname: vorname || null,
  nachname: nachname || null,
  email: email || null,
  telefon: telefon || null,
  strasse_hausnr: strasse_hausnr || null,
  plz_ort: plz_ort || null,
  geburtsdatum: geburtsdatum || null,
  beschaeftigungsgrad: beschaeftigungsgrad || null,
wunschtherapeut: wunschtherapeut || null,
assigned_therapist_id,

coaching_typ:
  coaching_typ === "paar" ? "paar" : "einzel",

// Optionale grobe Zeitpräferenz vor der Coach-Auswahl (Version 1, kein Pflichtfeld).
// Alte Anfragen ohne dieses Feld bleiben unverändert funktionsfähig.
structured_time_preference: Array.isArray(structured_time_preference)
  ? structured_time_preference
  : null,

...buildDraftRecoveryFields({ consent: draft_recovery_consent }),
draft_last_activity_at: new Date().toISOString(),
draft_current_step:
  Number.isInteger(draft_current_step) && draft_current_step >= 0
    ? draft_current_step
    : null,

status: "draft",
match_state: "draft",
};

    const { data, error } = await supabase.rpc("privacy_save_intake", {
      p_request_id: anfrageId || null,
      p_booking_token: booking_token || null,
      p_consent_id: consent.id,
      p_payload: payload,
      p_draft: true,
    });
    if (error || !data?.id) {
      const conflicts = [
        "REQUEST_ALREADY_FINALIZED", "INTAKE_RECIPIENT_CHANGE_REQUIRES_APPROVAL",
        "RECIPIENT_CONSENT_REQUIRED", "HEALTH_DATA_CONSENT_REQUIRED",
      ];
      const code = error?.message;
      console.error("DRAFT_SAVE_UNAVAILABLE", { code: error?.code || null });
      if (code === "REQUEST_NOT_FOUND") return json({ error: code }, 404);
      return json({ error: conflicts.includes(code) ? code : "DRAFT_SAVE_UNAVAILABLE" },
        conflicts.includes(code) ? 409 : 503);
    }

    return json({
      ok: true,
      id: data.id,
      booking_token: data.booking_token,
      assigned_therapist_id: data.assigned_therapist_id,
      care_version: data.care_version,
    });
  } catch (err) {
    console.error("CREATE REQUEST DRAFT ERROR");
    return json({ error: "SERVER_ERROR", detail: "INTERNAL_ERROR" }, 500);
  }
}
