import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST, buildKlaviyoAttribution } from "../../app/api/klaviyo/subscribe/route.js";

function request(body) {
  return new Request("https://app.example.invalid/api/klaviyo/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function sentKlaviyoBody() {
  return JSON.parse(global.fetch.mock.calls[0][1].body);
}

describe("klaviyo attribution", () => {
  it("keeps the existing app form source backward-compatible", () => {
    expect(buildKlaviyoAttribution({ source: "poise_app_form" })).toEqual({
      source: "poise_app_form",
      profileProperties: {},
    });
  });

  it("rejects unknown social landing topics instead of storing browser values", () => {
    expect(
      buildKlaviyoAttribution({
        source: "poise_social_landingpage",
        landing_page_topic: "manipulated-topic",
      })
    ).toMatchObject({ error: "invalid_landing_page_topic" });
  });

  it("normalizes controlled social attribution and utm fields", () => {
    expect(
      buildKlaviyoAttribution({
        source: "manipulated-source",
        landing_page_topic: "verlustangst",
        utm_source: " instagram ",
        utm_medium: " reel ",
        unknown_property: "must-not-pass",
      })
    ).toEqual({
      source: "poise_social_landingpage",
      profileProperties: {
        landing_page_topic: "verlustangst",
        last_landing_page_topic: "verlustangst",
        parent_matching_topic: "partnerschaft_beziehung",
        utm_source: "instagram",
        utm_medium: "reel",
      },
    });
  });
});

describe("klaviyo subscribe route", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 202,
      text: async () => "{}",
    }));
  });

  it("requires consent", async () => {
    const response = await POST(request({ email: "test@example.invalid", consent: false }));

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("keeps existing legacy signup working without topic properties", async () => {
    const response = await POST(
      request({
        email: "test@example.invalid",
        consent: true,
        source: "poise_app_form",
      })
    );

    expect(response.status).toBe(200);
    const body = sentKlaviyoBody();
    const profile = body.data.attributes.profiles.data[0].attributes;

    expect(body.data.attributes.custom_source).toBe("poise_app_form");
    expect(profile.email).toBe("test@example.invalid");
    expect(profile).not.toHaveProperty("properties");
  });

  it("passes validated social attribution and utm fields to Klaviyo profile properties", async () => {
    const response = await POST(
      request({
        email: "test@example.invalid",
        consent: true,
        source: "poise_social_landingpage",
        landing_page_topic: "verlustangst",
        parent_matching_topic: "tampered",
        utm_source: "instagram",
        utm_campaign: "verlustangst-pilot",
        random: "ignored",
      })
    );

    expect(response.status).toBe(200);
    const body = sentKlaviyoBody();
    const profile = body.data.attributes.profiles.data[0].attributes;

    expect(body.data.attributes.custom_source).toBe("poise_social_landingpage");
    expect(profile.properties).toEqual({
      landing_page_topic: "verlustangst",
      last_landing_page_topic: "verlustangst",
      parent_matching_topic: "partnerschaft_beziehung",
      utm_source: "instagram",
      utm_campaign: "verlustangst-pilot",
    });
    expect(profile.properties).not.toHaveProperty("random");
    expect(profile.properties.parent_matching_topic).not.toBe("tampered");
    expect(profile.properties).not.toHaveProperty("poise_interests");
  });

  it("rejects manipulated topic values before calling Klaviyo", async () => {
    const response = await POST(
      request({
        email: "test@example.invalid",
        consent: true,
        source: "poise_social_landingpage",
        landing_page_topic: "does-not-exist",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "invalid_landing_page_topic",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});