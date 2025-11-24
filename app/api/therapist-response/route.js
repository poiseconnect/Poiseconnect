export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const action = searchParams.get("action");
    const client = searchParams.get("client");
    const therapist =
      searchParams.get("therapist") ||
      searchParams.get("name") ||
      "";

    console.log("Therapist response:", action, client, therapist);

    // ✅ Termin bestätigen
    if (action === "confirm") {
      return Response.redirect(
        `https://poiseconnect.vercel.app/?resume=confirmed&email=${encodeURIComponent(client)}`,
        302
      );
    }

    // ✅ neuer Termin, gleiche Begleitung
    if (action === "rebook_same") {
      return Response.redirect(
        `https://poiseconnect.vercel.app/?resume=10&email=${encodeURIComponent(client)}&therapist=${encodeURIComponent(therapist)}`,
        302
      );
    }

    // ✅ anderes Teammitglied wählen
    if (action === "rebook_other") {
      return Response.redirect(
        `https://poiseconnect.vercel.app/?resume=5&email=${encodeURIComponent(client)}`,
        302
      );
    }

    return new Response(JSON.stringify({ ok: false, error: "UNKNOWN_ACTION" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("THERAPIST RESPONSE ERROR:", err);
    return new Response("SERVER_ERROR", { status: 500 });
  }
}
