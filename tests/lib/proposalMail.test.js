import { describe, expect, it } from "vitest";
import { createProposalMail } from "../../app/lib/messaging/proposalMail.js";

describe("proposal mail", () => {
  it("uses the active conversation alias as Resend reply_to and explains both contact paths", () => {
    const mail = createProposalMail({
      to: "client@example.invalid",
      replyAlias: "r-test-token@reply.mypoise.de",
      clientName: "Test",
      coachName: "Coach",
      link: "https://app.example.invalid/confirm-proposal?token=test-token",
    });

    expect(mail.reply_to).toBe("r-test-token@reply.mypoise.de");
    expect(mail).not.toHaveProperty("replyTo");
    expect(mail.html).toContain("Antworte einfach auf diese E-Mail");
    expect(mail.html).toContain("direkt auf der Seite mit den Terminvorschlägen schreiben");
  });
});