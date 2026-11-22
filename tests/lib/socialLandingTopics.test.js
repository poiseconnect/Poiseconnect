import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { metadata as beziehungMetadata } from "../../app/beziehung/page.jsx";
import { metadata as verlustangstMetadata } from "../../app/verlustangst/page.jsx";
import SocialLandingPage from "../../app/components/SocialLandingPage.jsx";
import { MATCHING_TOPIC_KEYS } from "../../app/lib/matchingTopics.js";
import {
  getSocialLandingTopic,
  socialLandingTopics,
} from "../../app/lib/socialLandingTopics.js";

vi.mock("next/image", () => ({
  default: ({ priority, ...props }) => React.createElement("img", props),
}));

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

describe("social landing pages without newsletter signup", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(["beziehung", "verlustangst"])("retains %s content without an email form", (slug) => {
    vi.stubGlobal("React", React);
    const topic = getSocialLandingTopic(slug);
    const markup = renderToStaticMarkup(React.createElement(SocialLandingPage, { topic }));

    expect(markup).toContain(topic.headline);
    expect(markup).toContain(topic.intro);
    expect(markup).toContain(topic.note);
    expect(markup).not.toMatch(/<form\b|<input\b|<button\b/);
    expect(readFileSync("app/components/SocialLandingPage.jsx", "utf8")).not.toContain("/api/klaviyo/subscribe");
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