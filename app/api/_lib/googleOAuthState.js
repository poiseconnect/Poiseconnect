import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_TTL_SECONDS = 5 * 60;

function sign(payload, secret) {
  return createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

export function createGoogleOAuthState(memberId, secret, now = Date.now()) {
  if (!memberId || !secret) {
    throw new Error("Google OAuth state requires a member and signing secret");
  }

  const state = randomBytes(32).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      memberId,
      state,
      expiresAt: now + STATE_TTL_SECONDS * 1000,
    })
  ).toString("base64url");

  return {
    state,
    cookieValue: `${payload}.${sign(payload, secret)}`,
    maxAge: STATE_TTL_SECONDS,
  };
}

export function verifyGoogleOAuthState(cookieValue, state, secret, now = Date.now()) {
  if (!cookieValue || !state || !secret) return null;

  const separator = cookieValue.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = cookieValue.slice(0, separator);
  const encodedSignature = cookieValue.slice(separator + 1);
  const providedSignature = Buffer.from(encodedSignature, "base64url");
  const expectedSignature = Buffer.from(sign(payload, secret), "base64url");
  if (
    providedSignature.toString("base64url") !== encodedSignature ||
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof data.memberId !== "string" ||
      data.state !== state ||
      !Number.isFinite(data.expiresAt) ||
      data.expiresAt <= now
    ) {
      return null;
    }

    return { memberId: data.memberId };
  } catch {
    return null;
  }
}
