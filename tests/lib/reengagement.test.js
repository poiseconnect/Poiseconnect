import { describe, expect, it } from "vitest";
import {
  buildReengagementEmail,
  classifySendOutcome,
  isUuid,
  isValidEmail,
  MAX_BATCH_SIZE,
  REENGAGEMENT_SUBJECT,
} from "../../app/lib/reengagement.js";

describe("reengagement email template", () => {
  it("uses the exact required subject", () => {
    expect(REENGAGEMENT_SUBJECT).toBe("Möchtest du noch einen passenden Coach finden?");
  });

  it("personalizes the greeting with the first name", () => {
    const mail = buildReengagementEmail({ vorname: "Maria" });
    expect(mail.html).toContain("Hallo Maria,");
    expect(mail.text).toContain("Hallo Maria,");
    expect(mail.subject).toBe(REENGAGEMENT_SUBJECT);
  });

  it("falls back to a neutral greeting when no first name is known", () => {
    const mail = buildReengagementEmail({ vorname: "" });
    expect(mail.html).toContain("Hallo liebe:r Interessent:in,");
    expect(mail.text).toContain("Hallo liebe:r Interessent:in,");
  });

  it("escapes HTML-relevant characters in the first name", () => {
    const mail = buildReengagementEmail({ vorname: "<script>alert(1)</script>" });
    expect(mail.html).not.toContain("<script>alert(1)</script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("does not mention old coach suggestions or booking links", () => {
    const mail = buildReengagementEmail({ vorname: "Jonas" });
    expect(mail.html.toLowerCase()).not.toContain("booking");
    expect(mail.html.toLowerCase()).not.toContain("token");
    expect(mail.html).not.toContain("href=");
  });
});

describe("isUuid", () => {
  it("accepts a valid v4 uuid", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
  });

  it("rejects non-uuid values", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(123)).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts a plausible address", () => {
    expect(isValidEmail("test@example.invalid")).toBe(true);
  });

  it("rejects missing or malformed addresses", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("missing-domain@")).toBe(false);
  });
});

describe("classifySendOutcome", () => {
  it("treats 2xx as sent (provider accepted, not confirmed delivery)", () => {
    expect(classifySendOutcome({ ok: true, status: 200 })).toBe("sent");
    expect(classifySendOutcome({ ok: true, status: 202 })).toBe("sent");
  });

  it("treats definite rejections as failed", () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(classifySendOutcome({ ok: false, status })).toBe("failed");
    }
  });

  it("treats ambiguous provider responses as unknown, not failed", () => {
    expect(classifySendOutcome({ ok: false, status: 429 })).toBe("unknown");
    expect(classifySendOutcome({ ok: false, status: 500 })).toBe("unknown");
    expect(classifySendOutcome({ ok: false, status: 503 })).toBe("unknown");
  });

  it("treats thrown exceptions (timeout/connection abort) as unknown", () => {
    expect(classifySendOutcome({ threwException: true })).toBe("unknown");
  });
});

describe("MAX_BATCH_SIZE", () => {
  it("is a conservative positive cap", () => {
    expect(MAX_BATCH_SIZE).toBeGreaterThan(0);
    expect(MAX_BATCH_SIZE).toBeLessThanOrEqual(100);
  });
});
