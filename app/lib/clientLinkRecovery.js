import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes } from "node:crypto";

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

function recoveryQueueKey() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("MISSING_RECOVERY_QUEUE_KEY");
  return Buffer.from(hkdfSync(
    "sha256",
    Buffer.from(serviceKey),
    Buffer.from("poise-client-link-recovery"),
    Buffer.from("outbox-v1"),
    32,
  ));
}

export function encryptRecoverySecret(secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", recoveryQueueKey(), iv);
  cipher.setAAD(Buffer.from("client-link-recovery:v1"));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url")].join(".");
}

export function decryptRecoverySecret(value) {
  const [version, encodedIv, encodedTag, encodedCiphertext, ...extra] = String(value).split(".");
  if (version !== "v1" || extra.length || !encodedIv || !encodedTag || !encodedCiphertext) {
    throw new Error("INVALID_RECOVERY_QUEUE_SECRET");
  }
  const decipher = createDecipheriv("aes-256-gcm", recoveryQueueKey(), Buffer.from(encodedIv, "base64url"));
  decipher.setAAD(Buffer.from("client-link-recovery:v1"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
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
