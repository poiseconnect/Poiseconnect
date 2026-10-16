import { createHash, randomBytes } from "node:crypto";
import { HEALTH_DATA_CONSENT_VERSION } from "./healthDataConsentShared.js";

export { HEALTH_DATA_CONSENT_VERSION };

export const HEALTH_DATA_FIELDS = [
  "themen",
  "anliegen",
  "leidensdruck",
  "verlauf",
  "diagnose",
  "ziel",
  "check_suizid",
  "terminwunsch_text",
];

export function newHealthDataConsentToken() {
  return randomBytes(32).toString("hex");
}

export function hashHealthDataConsentToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function hasHealthDataConsentToken(token) {
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
}

export async function findActiveHealthDataConsent(
  supabase,
  token,
  { requestId, allowUnlinked = false } = {}
) {
  if (!hasHealthDataConsentToken(token)) return null;

  const { data, error } = await supabase
    .from("anfrage_health_data_consents")
    .select("id, request_id, text_version, granted_at, revoked_at")
    .eq("token_hash", hashHealthDataConsentToken(token))
    .is("revoked_at", null)
    .maybeSingle();

  if (error) throw new Error("HEALTH_DATA_CONSENT_LOOKUP_FAILED");
  if (!data || data.text_version !== HEALTH_DATA_CONSENT_VERSION) return null;
  if (requestId !== undefined) {
    if (requestId === null && data.request_id !== null) return null;
    if (
      requestId !== null &&
      data.request_id !== requestId &&
      !(allowUnlinked && data.request_id === null)
    ) {
      return null;
    }
  }

  return data;
}

export async function attachHealthDataConsent(supabase, consent, requestId) {
  if (!consent || !requestId) return false;
  if (consent.request_id === requestId) return true;
  if (consent.request_id !== null) return false;

  const { data, error } = await supabase
    .from("anfrage_health_data_consents")
    .update({ request_id: requestId })
    .eq("id", consent.id)
    .is("request_id", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error("HEALTH_DATA_CONSENT_LINK_FAILED");
  if (data) return true;

  const { data: current, error: reloadError } = await supabase
    .from("anfrage_health_data_consents")
    .select("request_id, revoked_at")
    .eq("id", consent.id)
    .maybeSingle();

  if (reloadError) throw new Error("HEALTH_DATA_CONSENT_LOOKUP_FAILED");
  return current?.request_id === requestId && current.revoked_at === null;
}

export async function removeRequestAfterConsentLinkFailure(supabase, requestId) {
  const { error } = await supabase
    .from("anfragen")
    .delete()
    .eq("id", requestId);

  if (error) throw new Error("HEALTH_DATA_CONSENT_ROLLBACK_FAILED");
}
