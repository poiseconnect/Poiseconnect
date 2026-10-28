import { describe, expect, it } from "vitest";
import { createProposalMail } from "../../app/lib/messaging/proposalMail.js";

describe("proposal mail messaging metadata", () => {
  it("omits a Reply-To header when no messaging conversation is authorized", () => {
    const mail = createProposalMail({
      to: "client@example.invalid",
      replyAlias: null,
      clientName: "Example Client",
      coachName: "Example Coach",
      link: "https://app.example.invalid/confirm-proposal?token=synthetic",
    });

    expect(mail).not.toHaveProperty("reply_to");
  });

  it("uses the Reply-To header for an authorized conversation", () => {
    const mail = createProposalMail({
      to: "client@example.invalid",
      replyAlias: "r-synthetic@reply.mypoise.de",
      clientName: "Example Client",
      coachName: "Example Coach",
      link: "https://app.example.invalid/confirm-proposal?token=synthetic",
    });

    expect(mail.reply_to).toBe("r-synthetic@reply.mypoise.de");
  });
});
