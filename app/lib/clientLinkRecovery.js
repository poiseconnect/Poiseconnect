import { createHash, createHmac, randomBytes } from "node:crypto";

export const RECOVERY_MESSAGE =
  "Wenn die Angaben zu einem bestehenden Zugang passen, erhältst du eine E-Mail mit den nächsten Schritten.";

export const RECOVERY_PURPOSES = ["draft", "coach-selection", "appointment", "proposal"];

export function recoveryHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function recoveryRateKey(value) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY).update(value).digest("hex");
}

export function newRecoverySecret() {
  return randomBytes(32).toString("hex");
}

export function recoveryOrigin() {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://app.mypoise.de");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
    throw new Error("INVALID_RECOVERY_ORIGIN");
  }
  return url.origin;
}

export function recoveryDestination({ request_id, booking_token, purpose, resume_step }) {
  if (!request_id || !booking_token || !RECOVERY_PURPOSES.includes(purpose)) {
    throw new Error("INVALID_RECOVERY_GRANT");
  }
  const url = new URL(purpose === "proposal" ? "/confirm-proposal" : "/", recoveryOrigin());
  url.searchParams.set("token", booking_token);
  if (purpose !== "proposal") {
    url.searchParams.set("rid", request_id);
    const step = purpose === "appointment" ? 10 : purpose === "coach-selection" ? 8 :
      Number.isInteger(resume_step) && resume_step >= 0 && resume_step <= 11 ? resume_step : 8;
    url.searchParams.set("resume", String(step));
  }
  return url.toString();
}
