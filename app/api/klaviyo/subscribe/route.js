import { NextResponse } from "next/server";
import {
  SOCIAL_LANDING_SOURCE,
  UTM_FIELDS,
  socialLandingTopicsByLandingTopic,
} from "../../../lib/socialLandingTopics.js";

const ALLOWED_SOURCES = new Set([
  "poise_app_form",
  SOCIAL_LANDING_SOURCE,
  "beziehung_landingpage",
]);

function normalizeText(value, maxLength = 160) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function buildKlaviyoAttribution(body = {}) {
  const landingTopic = normalizeText(body.landing_page_topic, 80);
  const topicConfig = landingTopic
    ? socialLandingTopicsByLandingTopic[landingTopic]
    : null;
  const source = topicConfig
    ? SOCIAL_LANDING_SOURCE
    : ALLOWED_SOURCES.has(body.source)
      ? body.source
      : "poise_app_form";

  if (landingTopic && !topicConfig) {
    return {
      error: "invalid_landing_page_topic",
      source,
      profileProperties: {},
    };
  }

  const profileProperties = {};

  if (topicConfig) {
    profileProperties.landing_page_topic = topicConfig.landingTopic;
    profileProperties.last_landing_page_topic = topicConfig.landingTopic;
    profileProperties.parent_matching_topic = topicConfig.parentTopic;
  }

  for (const field of UTM_FIELDS) {
    const value = normalizeText(body[field], 240);
    if (value) profileProperties[field] = value;
  }

  return { source, profileProperties };
}

export async function POST(request) {
  try {
    const body = await request.json();

    const { email, consent } = body;

    if (!email || consent !== true) {
      return NextResponse.json(
        { ok: false, message: "Missing email or consent" },
        { status: 400 }
      );
    }

    const attribution = buildKlaviyoAttribution(body);

    if (attribution.error) {
      return NextResponse.json(
        { ok: false, message: attribution.error },
        { status: 400 }
      );
    }

    const profileAttributes = {
      email,
      subscriptions: {
        email: {
          marketing: {
            consent: "SUBSCRIBED",
          },
        },
      },
    };

    if (Object.keys(attribution.profileProperties).length > 0) {
      profileAttributes.properties = attribution.profileProperties;
    }

    const klaviyoRes = await fetch(
      "https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs",
      {
        method: "POST",
        headers: {
          Authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_PRIVATE_API_KEY}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          revision: "2024-10-15",
        },
        body: JSON.stringify({
          data: {
            type: "profile-subscription-bulk-create-job",
            attributes: {
              custom_source: attribution.source,
              profiles: {
                data: [
                  {
                    type: "profile",
                    attributes: profileAttributes,
                  },
                ],
              },
            },
            relationships: {
              list: {
                data: {
                  type: "list",
                  id: process.env.KLAVIYO_LIST_ID,
                },
              },
            },
          },
        }),
      }
    );

    const text = await klaviyoRes.text();

    if (!klaviyoRes.ok) {
      console.error("KLAVIYO ERROR", { providerStatus: klaviyoRes.status });
      return new Response(
        JSON.stringify({ ok: false, error: text }),
        { status: klaviyoRes.status, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, response: text }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("KLAVIYO SUBSCRIBE ERROR");
    return new Response(
      JSON.stringify({ ok: false, error: "INTERNAL_ERROR" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
