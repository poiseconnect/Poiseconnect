import { createHash, randomBytes } from "node:crypto";

function normalizeReplyDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/\.$/, "");
}

export function getReplyDomain(value = process.env.RESEND_REPLY_DOMAIN) {
  const domain = normalizeReplyDomain(value);

  if (!domain) {
    throw new Error("RESEND_REPLY_DOMAIN_MISSING");
  }

  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)) {
    throw new Error("RESEND_REPLY_DOMAIN_INVALID");
  }

  return domain;
}

export function hashReplyToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function createReplyAlias(domain) {
  const token = randomBytes(32).toString("base64url");
  const replyDomain = getReplyDomain(domain);

  return {
    replyAlias: `r-${token}@${replyDomain}`,
    replyTokenHash: hashReplyToken(token),
  };
}

export function parseReplyAlias(value, domain) {
  const replyDomain = getReplyDomain(domain);
  const normalized = String(value || "").trim();
  const match = normalized.match(new RegExp(`^r-([A-Za-z0-9_-]{43})@${replyDomain.replaceAll(".", "\\.")}$`, "i"));

  return match
    ? { replyAlias: `r-${match[1]}@${replyDomain}`, replyToken: match[1] }
    : null;
}