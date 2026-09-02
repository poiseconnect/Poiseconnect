import { describe, expect, it } from "vitest";
import {
  createReplyAlias,
  hashReplyToken,
  parseReplyAlias,
} from "../../app/lib/messaging/aliases.js";

describe("messaging reply aliases", () => {
  it("erzeugt einen Alias im erwarteten Format", () => {
    const { replyAlias, replyTokenHash } = createReplyAlias("reply.mypoise.de");

    expect(replyAlias).toMatch(/^r-[A-Za-z0-9_-]{43}@reply\.mypoise\.de$/);
    expect(replyTokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("erzeugt unterschiedliche Alias-Identitäten", () => {
    const first = createReplyAlias("reply.mypoise.de");
    const second = createReplyAlias("reply.mypoise.de");

    expect(first.replyAlias).not.toBe(second.replyAlias);
    expect(first.replyTokenHash).not.toBe(second.replyTokenHash);
  });

  it("hasht denselben Token deterministisch ohne den Token preiszugeben", () => {
    const token = "test-token-not-a-secret";
    const hash = hashReplyToken(token);

    expect(hashReplyToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
  });

  it("verlangt eine explizite Reply-Domain", () => {
    const previousDomain = process.env.RESEND_REPLY_DOMAIN;
    delete process.env.RESEND_REPLY_DOMAIN;

    expect(() => createReplyAlias()).toThrow("RESEND_REPLY_DOMAIN_MISSING");

    process.env.RESEND_REPLY_DOMAIN = previousDomain;
  });

  it("erhält die Groß- und Kleinschreibung des Alias-Tokens", () => {
    const token = `${"Ab".repeat(21)}A`;
    const parsed = parseReplyAlias(`r-${token}@REPLY.MYPOISE.DE`, "reply.mypoise.de");

    expect(parsed).toEqual({
      replyAlias: `r-${token}@reply.mypoise.de`,
      replyToken: token,
    });
    expect(hashReplyToken(parsed.replyToken)).toBe(hashReplyToken(token));
  });
});