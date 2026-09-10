export const DRAFT_RECOVERY_CONSENT_VERSION = "2026-09-10-v1";

export const DRAFT_RECOVERY_CONSENT_TEXT =
  "Erinnere mich per E-Mail, falls ich meine Anfrage nicht abschließe. Poise darf mir einmalig eine E-Mail senden, damit ich meine begonnene Anfrage fortsetzen kann. Ich kann diese Einwilligung jederzeit widerrufen.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function buildDraftRecoveryFields({ consent, now = new Date() } = {}) {
  if (consent !== true) {
    return {
      draft_recovery_consent: false,
      draft_recovery_consent_at: null,
      draft_recovery_consent_version: null,
    };
  }

  const consentAt = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(consentAt.getTime())) {
    throw new Error("INVALID_CONSENT_TIMESTAMP");
  }

  return {
    draft_recovery_consent: true,
    draft_recovery_consent_at: consentAt.toISOString(),
    draft_recovery_consent_version: DRAFT_RECOVERY_CONSENT_VERSION,
  };
}

export function isDraftRecoveryEligible(request) {
  if (!request || request.status !== "draft") return false;

  const email = String(request.email || "").trim();
  if (!EMAIL_PATTERN.test(email)) return false;
  if (request.draft_recovery_consent !== true) return false;
  if (!request.draft_recovery_consent_at) return false;
  if (!String(request.draft_recovery_consent_version || "").trim()) {
    return false;
  }
  if (request.draft_reminder_sent_at != null) return false;

  return true;
}
