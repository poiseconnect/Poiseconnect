import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      email,
      firstName,
      lastName,
      consent,
      source = "poise_app_form",
    } = body;

    if (!email || consent !== true) {
      return NextResponse.json(
        { ok: false, message: "Missing email or consent" },
        { status: 400 }
      );
    }

    const response = await fetch(
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
                      first_name: firstName || "",
                      last_name: lastName || "",
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

    const responseText = await response.text();

    if (!response.ok) {
      console.error("Klaviyo error:", responseText);
      return NextResponse.json(
        { ok: false, error: responseText },
        { status: response.status }
      );
    }

    return NextResponse.json({ ok: true, response: responseText });
  } catch (error) {
    console.error("Klaviyo subscribe error:", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
