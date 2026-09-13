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

export function isDraftRecoveryEligible(request, { now = new Date() } = {}) {
  if (!request || request.status !== "draft") return false;

  const email = String(request.email || "").trim();
  if (!EMAIL_PATTERN.test(email)) return false;

  const bookingToken = String(request.booking_token || "").trim();
  if (!bookingToken) return false;

  if (request.draft_recovery_consent !== true) return false;
  if (!request.draft_recovery_consent_at) return false;
  if (!String(request.draft_recovery_consent_version || "").trim()) {
    return false;
  }
  if (request.draft_reminder_sent_at != null) return false;

  if (!request.draft_last_activity_at) return false;
  const lastActivity = new Date(request.draft_last_activity_at);
  if (Number.isNaN(lastActivity.getTime())) return false;

  const nowMs = (now instanceof Date ? now : new Date(now)).getTime();
  if (Number.isNaN(nowMs)) return false;

  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  if (nowMs - lastActivity.getTime() < FORTY_EIGHT_HOURS_MS) {
    return false;
  }

  return true;
}

export function buildDraftRecoveryResumeUrl(
  request,
  { baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://app.mypoise.de" } = {}
) {
  const step =
    Number.isInteger(request?.draft_current_step) && request.draft_current_step >= 0
      ? request.draft_current_step
      : 8;

  const cleanBase = String(baseUrl || "https://app.mypoise.de").replace(/\/+$/, "");
  const rid = encodeURIComponent(String(request?.id || ""));
  const token = encodeURIComponent(String(request?.booking_token || ""));

  return `${cleanBase}?resume=${step}&rid=${rid}&token=${token}`;
}

export function buildDraftRecoveryEmail({ request, resumeUrl }) {
  const safeVorname = String(request?.vorname || "").trim() || "du";

  const subject = "Deine Anfrage bei Poise 🤍";

  const html = `
<p>Hallo ${safeVorname},</p>

<p>
  du hast vor einiger Zeit eine Anfrage bei Poise begonnen, aber noch nicht abgeschlossen.
</p>

<p>
  Wenn du möchtest, kannst du genau dort weitermachen, wo du aufgehört hast:
</p>

<p>
  <a href="${resumeUrl}" target="_blank" style="color:#8E3A4A; font-weight:600;">
    👉 Anfrage fortsetzen
  </a>
</p>

<p>
  Wenn du deine Anfrage nicht mehr fortsetzen möchtest, musst du nichts tun.
</p>

<p>
  Liebe Grüße<br/>
  Poise
</p>
  `.trim();

  return { subject, html };
}

export async function sendDraftRecoveryReminders({
  supabase,
  sendMail,
  now = new Date(),
  baseUrl,
}) {
  if (!supabase || typeof sendMail !== "function") {
    return { sentCount: 0, errors: [], sentLogs: [] };
  }

  const { data: requests, error } = await supabase
    .from("anfragen")
    .select(`
      id,
      vorname,
      email,
      booking_token,
      status,
      draft_recovery_consent,
      draft_recovery_consent_at,
      draft_recovery_consent_version,
      draft_last_activity_at,
      draft_current_step,
      draft_reminder_sent_at
    `)
    .eq("status", "draft")
    .eq("draft_recovery_consent", true)
    .is("draft_reminder_sent_at", null);

  if (error) {
    console.error("DRAFT RECOVERY LOAD ERROR:", { code: error?.code || null });
    return { sentCount: 0, errors: [error], sentLogs: [] };
  }

  let sentCount = 0;
  const errors = [];
  const sentLogs = [];

  const sentAtIso = (now instanceof Date ? now : new Date(now)).toISOString();

  for (const request of requests || []) {
    if (!isDraftRecoveryEligible(request, { now })) {
      continue;
    }

    try {
      const resumeUrl = buildDraftRecoveryResumeUrl(request, { baseUrl });
      const { subject, html } = buildDraftRecoveryEmail({ request, resumeUrl });

      // Send mail FIRST (idempotency safety)
      await sendMail({
        to: request.email,
        subject,
        html,
      });

      // Update DB ONLY AFTER successful email send
      const { error: updateError } = await supabase
        .from("anfragen")
        .update({ draft_reminder_sent_at: sentAtIso })
        .eq("id", request.id);

      if (updateError) {
        console.error("DRAFT RECOVERY UPDATE FLAG ERROR:", {
          requestId: request.id,
          code: updateError?.code || null,
        });
        errors.push({ id: request.id, error: updateError });
      } else {
        sentCount += 1;
        sentLogs.push({ id: request.id, email: request.email, type: "draft_recovery" });
      }
    } catch (sendError) {
      console.error("DRAFT RECOVERY MAIL SEND ERROR:", {
        requestId: request.id,
        error: sendError?.message || sendError,
      });
      errors.push({ id: request.id, error: sendError });
    }
  }

  return { sentCount, errors, sentLogs };
}
