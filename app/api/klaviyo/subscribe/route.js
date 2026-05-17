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
      anliegen,
      leidensdruck,
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
          revision: "2026-04-15",
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
                      properties: {
                        first_name: firstName || "",
                        last_name: lastName || "",
                        source,
                        anliegen: anliegen || "",
                        leidensdruck: leidensdruck || "",
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

    if (!response.ok) {
      const error = await response.text();
      console.error("Klaviyo error:", error);

      return NextResponse.json(
        { ok: false, error },
        { status: response.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Klaviyo subscribe error:", error);

    return NextResponse.json(
      { ok: false, error: "Klaviyo subscription failed" },
      { status: 500 }
    );
  }
}
