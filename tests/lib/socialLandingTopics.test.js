import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { metadata as beziehungMetadata } from "../../app/beziehung/page.jsx";
import { metadata as verlustangstMetadata } from "../../app/verlustangst/page.jsx";
import { buildSocialLandingSubscribePayload } from "../../app/components/SocialLandingPage.jsx";
import { MATCHING_TOPIC_KEYS } from "../../app/lib/matchingTopics.js";
import {
  SOCIAL_LANDING_SOURCE,
  getSocialLandingTopic,
  socialLandingTopics,
} from "../../app/lib/socialLandingTopics.js";

function params(values = {}) {
  return {
    get(key) {
      return values[key] || null;
    },
  };
}

describe("social landing topic config", () => {
  it("uses unique slugs", () => {
    const slugs = socialLandingTopics.map((topic) => topic.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("uses only canonical matching topic keys for parent and related topics", () => {
    for (const topic of socialLandingTopics) {
      expect(MATCHING_TOPIC_KEYS).toContain(topic.parentTopic);

      for (const relatedTopic of topic.relatedMatchingTopics) {
        expect(MATCHING_TOPIC_KEYS).toContain(relatedTopic);
      }
    }
  });

  it("maps verlustangst to the finer landing topic and the relationship parent topic", () => {
    expect(getSocialLandingTopic("verlustangst")).toMatchObject({
      slug: "verlustangst",
      landingTopic: "verlustangst",
      parentTopic: "partnerschaft_beziehung",
      relatedMatchingTopics: ["partnerschaft_beziehung", "angst_panik"],
    });
  });

  it("keeps beziehung mapped to its existing relationship topic", () => {
    expect(getSocialLandingTopic("beziehung")).toMatchObject({
      slug: "beziehung",
      landingTopic: "beziehung",
      parentTopic: "partnerschaft_beziehung",
      relatedMatchingTopics: ["partnerschaft_beziehung"],
      cta: "Kostenlose Beziehungsimpulse erhalten",
    });
  });
});

describe("social landing signup payload", () => {
  it("keeps beziehung on the controlled social source and config attribution", () => {
    const topic = getSocialLandingTopic("beziehung");

    expect(buildSocialLandingSubscribePayload(topic, "test@example.invalid", params())).toEqual({
      email: "test@example.invalid",
      consent: true,
      source: SOCIAL_LANDING_SOURCE,
      landing_page_topic: "beziehung",
      parent_matching_topic: "partnerschaft_beziehung",
    });
  });

  it("sends verlustangst landing topic and utm fields from the URL", () => {
    const topic = getSocialLandingTopic("verlustangst");

    expect(
      buildSocialLandingSubscribePayload(
        topic,
        "test@example.invalid",
        params({ utm_source: "instagram", utm_campaign: "reel-1" })
      )
    ).toMatchObject({
      source: SOCIAL_LANDING_SOURCE,
      landing_page_topic: "verlustangst",
      parent_matching_topic: "partnerschaft_beziehung",
      utm_source: "instagram",
      utm_campaign: "reel-1",
    });
  });
});

describe("social landing noindex metadata", () => {
  it("marks beziehung as noindex and follow", () => {
    expect(beziehungMetadata.robots).toEqual({ index: false, follow: true });
  });

  it("marks verlustangst as noindex and follow", () => {
    expect(verlustangstMetadata.robots).toEqual({ index: false, follow: true });
  });

  it("does not configure noindex globally", () => {
    const rootLayout = readFileSync("app/layout.jsx", "utf8");

    expect(rootLayout).not.toContain("robots");
    expect(rootLayout).not.toContain("noindex");
  });
});