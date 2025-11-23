export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const fullUrl =
      request.url.startsWith("http")
        ? request.url
        : `https://${request.headers.get("host")}${request.url}`;

    const url = new URL(fullUrl);
    const action = url.searchParams.get("action");
    const client = url.searchParams.get("client");
    const name = url.searchParams.get("name");

    console.log("Therapist response:", action, client, name);

    // ✅ Termin bestätigen
    if (action === "confirm") {
      return Response.redirect(
        `https://mypoise.de/?resume=confirmed&email=${encodeURIComponent(client)}`,
        302
      );
    }

    // ✅ neuer Termin, gleiche Begleitung
    if (action === "rebook_same") {
      return Response.redirect(
        `https://mypoise.de/?resume=10&email=${encodeURIComponent(client)}`,
        302
      );
    }

    // ✅ anderes Teammitglied wählen
    if (action === "rebook_other") {
      return Response.redirect(
        `https://mypoise.de/?resume=5&email=${encodeURIComponent(client)}`,
        302
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: "UNKNOWN_ACTION" }),
      { status: 400 }
    );

  } catch (err) {
    console.error("THERAPIST RESPONSE ERROR:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "SERVER_ERROR" }),
      { status: 500 }
    );
  }
}
