export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { buildDraftRecoveryFields } from "../../lib/draftRecovery.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
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
} = body || {};

    if (anfrageId) {
      const { data: existingRequest, error: loadError } = await supabase
        .from("anfragen")
        .select("status")
        .eq("id", anfrageId)
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

    if (anfrageId) {
      const { data, error } = await supabase
        .from("anfragen")
        .update(payload)
        .eq("id", anfrageId)
        .eq("status", "draft")
        .select("id, booking_token, assigned_therapist_id")
        .maybeSingle();

      if (error) {
        console.error("DRAFT UPDATE ERROR:", { code: error?.code || null });
        return json({ error: "DRAFT_UPDATE_FAILED" }, 500);
      }

      if (!data) {
        const { data: currentRequest, error: currentLoadError } = await supabase
          .from("anfragen")
          .select("status")
          .eq("id", anfrageId)
          .maybeSingle();

        if (currentLoadError) {
          console.error("DRAFT CONFLICT STATUS LOAD ERROR:", {
            requestId: anfrageId,
            code: currentLoadError?.code || null,
          });
          return json({ error: "DRAFT_LOAD_FAILED" }, 500);
        }

        if (!currentRequest) {
          return json({ error: "REQUEST_NOT_FOUND" }, 404);
        }

        console.warn("DRAFT UPDATE CONFLICT", {
          route: "/api/create-request-draft",
          requestId: anfrageId,
          currentStatus: currentRequest.status,
          code: "REQUEST_ALREADY_FINALIZED",
        });
        return json({ error: "REQUEST_ALREADY_FINALIZED" }, 409);
      }

      return json({
        ok: true,
        id: data.id,
        booking_token: data.booking_token,
        assigned_therapist_id: data.assigned_therapist_id,
      });
    }

    const { data, error } = await supabase
      .from("anfragen")
      .insert({
        ...payload,
        booking_token: crypto.randomUUID(),
      })
      .select("id, booking_token, assigned_therapist_id")
      .single();

    if (error) {
      console.error("DRAFT INSERT ERROR:", { code: error?.code || null });
      return json({ error: "DRAFT_INSERT_FAILED" }, 500);
    }

    return json({
      ok: true,
      id: data.id,
      booking_token: data.booking_token,
      assigned_therapist_id: data.assigned_therapist_id,
    });
  } catch (err) {
    console.error("CREATE REQUEST DRAFT ERROR");
    return json({ error: "SERVER_ERROR", detail: "INTERNAL_ERROR" }, 500);
  }
}
