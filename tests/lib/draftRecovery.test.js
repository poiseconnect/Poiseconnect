import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  DRAFT_RECOVERY_CONSENT_VERSION,
  buildDraftRecoveryFields,
  isDraftRecoveryEligible,
  buildDraftRecoveryResumeUrl,
  buildDraftRecoveryEmail,
  sendDraftRecoveryReminders,
} from "../../app/lib/draftRecovery.js";

const now = new Date("2026-09-12T10:00:00.000Z");
const activityOver48hAgo = "2026-09-10T09:00:00.000Z";
const activityUnder48hAgo = "2026-09-11T12:00:00.000Z";

const validCandidate = {
  id: "draft-123",
  status: "draft",
  email: "test@example.invalid",
  booking_token: "token-456",
  draft_recovery_consent: true,
  draft_recovery_consent_at: "2026-09-10T08:00:00.000Z",
  draft_recovery_consent_version: DRAFT_RECOVERY_CONSENT_VERSION,
  draft_last_activity_at: activityOver48hAgo,
  draft_current_step: 8,
  draft_reminder_sent_at: null,
};

describe("draft recovery eligibility rules", () => {
  it("1. accepts consent true + >48h + draft with booking_token and email", () => {
    expect(isDraftRecoveryEligible(validCandidate, { now })).toBe(true);
  });

  it("2. rejects when consent is false or missing", () => {
    expect(
      isDraftRecoveryEligible(
        { ...validCandidate, draft_recovery_consent: false },
        { now }
      )
    ).toBe(false);
    expect(
      isDraftRecoveryEligible(
        { ...validCandidate, draft_recovery_consent_at: null },
        { now }
      )
    ).toBe(false);
  });

  it("3. rejects when last activity is <48h ago", () => {
    expect(
      isDraftRecoveryEligible(
        { ...validCandidate, draft_last_activity_at: activityUnder48hAgo },
        { now }
      )
    ).toBe(false);
  });

  it("4. rejects when reminder_sent_at is already set (no second mail)", () => {
    expect(
      isDraftRecoveryEligible(
        { ...validCandidate, draft_reminder_sent_at: "2026-09-11T10:00:00.000Z" },
        { now }
      )
    ).toBe(false);
  });

  it("5. rejects when status is no longer draft", () => {
    expect(
      isDraftRecoveryEligible({ ...validCandidate, status: "neu" }, { now })
    ).toBe(false);
    expect(
      isDraftRecoveryEligible(
        { ...validCandidate, status: "termin_bestaetigt" },
        { now }
      )
    ).toBe(false);
  });

  it("rejects missing booking_token or missing/invalid email", () => {
    expect(
      isDraftRecoveryEligible(
        { ...validCandidate, booking_token: "" },
        { now }
      )
    ).toBe(false);
    expect(
      isDraftRecoveryEligible(
        { ...validCandidate, email: "invalid-email" },
        { now }
      )
    ).toBe(false);
  });
});

describe("draft recovery email formatting and resume link", () => {
  it("8. resume link contains rid and booking_token", () => {
    const resumeUrl = buildDraftRecoveryResumeUrl(validCandidate, {
      baseUrl: "https://app.mypoise.de",
    });

    expect(resumeUrl).toBe(
      "https://app.mypoise.de?resume=8&rid=draft-123&token=token-456"
    );
  });

  it("9. email contains no psychological fields or themes", () => {
    const resumeUrl = buildDraftRecoveryResumeUrl(validCandidate);
    const candidateWithPsychData = {
      ...validCandidate,
      vorname: "Maria",
      anliegen: "Angst und Panik",
      themen: ["angst_panik"],
      leidensdruck: "sehr hoch",
      diagnose: "Ja",
      verlauf: "seit Jahren",
      ziel: "Ruhe",
    };

    const { subject, html } = buildDraftRecoveryEmail({
      request: candidateWithPsychData,
      resumeUrl,
    });

    expect(subject).toBe("Deine Anfrage bei Poise 🤍");
    expect(html).toContain("Hallo Maria,");
    expect(html).toContain(resumeUrl);
    expect(html).toContain("Anfrage fortsetzen");

    // Must NOT contain any psychological fields or sensitive data
    expect(html).not.toContain("Angst");
    expect(html).not.toContain("Panik");
    expect(html).not.toContain("anliegen");
    expect(html).not.toContain("themen");
    expect(html).not.toContain("leidensdruck");
    expect(html).not.toContain("diagnose");
    expect(html).not.toContain("verlauf");
    expect(html).not.toContain("ziel");
  });
});

describe("draft recovery sending and idempotency", () => {
  it("6. successful send sets draft_reminder_sent_at in DB after sending", async () => {
    const sendMail = vi.fn(async () => ({ id: "mail-1" }));
    let updatePayload = null;

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(async () => ({
                data: [validCandidate],
                error: null,
              })),
            })),
          })),
        })),
        update: vi.fn((payload) => {
          updatePayload = payload;
          return {
            eq: vi.fn(async () => ({ error: null })),
          };
        }),
      })),
    };

    const result = await sendDraftRecoveryReminders({
      supabase: mockSupabase,
      sendMail,
      now,
      baseUrl: "https://app.mypoise.de",
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith({
      to: "test@example.invalid",
      subject: "Deine Anfrage bei Poise 🤍",
      html: expect.stringContaining("https://app.mypoise.de?resume=8&rid=draft-123&token=token-456"),
    });

    expect(updatePayload).toEqual({
      draft_reminder_sent_at: "2026-09-12T10:00:00.000Z",
    });
    expect(result.sentCount).toBe(1);
  });

  it("7. failed send does NOT set draft_reminder_sent_at in DB", async () => {
    const sendMail = vi.fn(async () => {
      throw new Error("Resend API Error 500");
    });
    const updateFn = vi.fn();

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(async () => ({
                data: [validCandidate],
                error: null,
              })),
            })),
          })),
        })),
        update: updateFn,
      })),
    };

    const result = await sendDraftRecoveryReminders({
      supabase: mockSupabase,
      sendMail,
      now,
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(updateFn).not.toHaveBeenCalled();
    expect(result.sentCount).toBe(0);
    expect(result.errors.length).toBe(1);
  });
});

describe("draft recovery consent storage helpers", () => {
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
