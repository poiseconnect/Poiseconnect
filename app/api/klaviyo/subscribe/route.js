import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();

    const { email, consent, source = "poise_app_form" } = body;

    if (!email || consent !== true) {
      return NextResponse.json(
        { ok: false, message: "Missing email or consent" },
        { status: 400 }
      );
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
              custom_source: source,
              profiles: {
                data: [
                  {
                    type: "profile",
                    attributes: {
                      email,
                      subscriptions: {
                        email: {
                          marketing: {
                            consent: "SUBSCRIBED",
                          },
                        },
                      },
                    },
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
      console.error("Klaviyo error:", text);
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
    console.error("Klaviyo subscribe error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
