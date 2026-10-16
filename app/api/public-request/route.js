export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { findActiveHealthDataConsent } from "../../lib/healthDataConsent.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return createClient(url, key);
}

export const PUBLIC_REQUEST_BASE_SELECT_FIELDS = [
  "id",
  "vorname",
  "nachname",
  "email",
  "telefon",
  "strasse_hausnr",
  "plz_ort",
  "geburtsdatum",
  "beschaeftigungsgrad",
  "coaching_typ",
  "wunschtherapeut",
  "assigned_therapist_id",
  "admin_therapeuten",
  "structured_time_preference",
  "bevorzugte_zeit",
].join(", ");

export const PUBLIC_REQUEST_HEALTH_DATA_SELECT_FIELDS = [
  "themen",
  "anliegen",
  "leidensdruck",
  "verlauf",
  "diagnose",
  "ziel",
  "check_suizid",
  "terminwunsch_text",
].join(", ");

export const PUBLIC_REQUEST_SELECT_FIELDS = [
  PUBLIC_REQUEST_BASE_SELECT_FIELDS,
  PUBLIC_REQUEST_HEALTH_DATA_SELECT_FIELDS,
].join(", ");

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const token = url.searchParams.get("token");

    if (!id) {
      return json({ error: "MISSING_ID" }, 400);
    }
    if (!token) {
      return json({ error: "RECOVERY_REQUIRED" }, 401);
    }

    const supabase = getSupabase();
    if (!supabase) {
      return json({ error: "SUPABASE_NOT_CONFIGURED" }, 500);
    }

    const consentToken = req.headers.get("x-health-data-consent");
    const consent = consentToken
      ? await findActiveHealthDataConsent(supabase, consentToken, {
          requestId: id,
        })
      : null;

    const fields = consent
      ? PUBLIC_REQUEST_SELECT_FIELDS
      : PUBLIC_REQUEST_BASE_SELECT_FIELDS;
    const { data, error } = await supabase
      .from("anfragen")
      .select(fields)
      .eq("id", id)
      .eq("booking_token", token)
      .single();

    if (error || !data) {
      return json({ error: "REQUEST_NOT_FOUND" }, 404);
    }

    return json({
      request: data,
      sensitiveDataConsentRequired: !consent,
    });
  } catch (err) {
    console.error("PUBLIC REQUEST ERROR");
    return json(
      { error: "SERVER_ERROR", detail: "INTERNAL_ERROR" },
      500
    );
  }
}
