import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DRAFT_RECOVERY_CONSENT_VERSION,
  buildDraftRecoveryFields,
  isDraftRecoveryEligible,
} from "../../app/lib/draftRecovery.js";

const validConsent = {
  status: "draft",
  email: "test@example.invalid",
  draft_recovery_consent: true,
  draft_recovery_consent_at: "2026-09-10T10:00:00.000Z",
  draft_recovery_consent_version: DRAFT_RECOVERY_CONSENT_VERSION,
  draft_reminder_sent_at: null,
};

describe("draft recovery consent", () => {
  it("stores no consent metadata when the checkbox is absent or false", () => {
    expect(buildDraftRecoveryFields()).toEqual({
      draft_recovery_consent: false,
      draft_recovery_consent_at: null,
      draft_recovery_consent_version: null,
    });
    expect(buildDraftRecoveryFields({ consent: false })).toEqual({
      draft_recovery_consent: false,
      draft_recovery_consent_at: null,
      draft_recovery_consent_version: null,
    });
  });

  it("creates server-side consent metadata for an explicit true value", () => {
    expect(
      buildDraftRecoveryFields({
        consent: true,
        now: "2026-09-10T10:00:00.000Z",
      })
    ).toEqual({
      draft_recovery_consent: true,
      draft_recovery_consent_at: "2026-09-10T10:00:00.000Z",
      draft_recovery_consent_version: DRAFT_RECOVERY_CONSENT_VERSION,
    });
  });

  it("keeps recovery consent independent from newsletter and privacy fields", () => {
    expect(buildDraftRecoveryFields({ consent: false }).draft_recovery_consent).toBe(false);
    expect(buildDraftRecoveryFields({ consent: true }).draft_recovery_consent).toBe(true);
  });

  it("rejects missing email and already reminded drafts", () => {
    expect(isDraftRecoveryEligible({ ...validConsent, email: "" })).toBe(false);
    expect(
      isDraftRecoveryEligible({
        ...validConsent,
        draft_reminder_sent_at: "2026-09-11T10:00:00.000Z",
      })
    ).toBe(false);
  });

  it("rejects legacy drafts without recovery consent metadata", () => {
    expect(isDraftRecoveryEligible({ status: "draft", email: "test@example.invalid" })).toBe(false);
  });

  it("accepts only a complete eligible draft", () => {
    expect(isDraftRecoveryEligible(validConsent)).toBe(true);
    expect(isDraftRecoveryEligible({ ...validConsent, status: "neu" })).toBe(false);
    expect(isDraftRecoveryEligible({ ...validConsent, draft_recovery_consent: false })).toBe(false);
    expect(isDraftRecoveryEligible({ ...validConsent, draft_recovery_consent_at: null })).toBe(false);
    expect(isDraftRecoveryEligible({ ...validConsent, draft_recovery_consent_version: null })).toBe(false);
  });
});

describe("draft recovery integration boundaries", () => {
  it("keeps recovery consent optional and separate in the form", () => {
    const formSource = readFileSync("app/page-client.jsx", "utf8");

    expect(formSource).toContain("draft_recovery_consent: false");
    expect(formSource).toContain("draft_recovery_consent: form.draft_recovery_consent === true");
    expect(formSource).toContain("!form.check_datenschutz ||");
    expect(formSource).not.toContain("!form.draft_recovery_consent ||");
    expect(formSource).toContain("newsletter_consent");
  });

  it("does not add recovery-mail sending to the draft route or final submit", () => {
    const draftRoute = readFileSync("app/api/create-request-draft/route.js", "utf8");
    const submitRoute = readFileSync("app/api/form-submit/route.js", "utf8");

    expect(draftRoute).not.toContain("resend");
    expect(draftRoute).not.toContain("emails.send");
    expect(submitRoute).not.toContain("draft_reminder_sent_at");
    expect(submitRoute).not.toContain("draft_recovery_consent");
  });
});
