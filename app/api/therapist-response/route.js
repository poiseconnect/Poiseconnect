export const dynamic = "force-dynamic";

// ✅ wir verwenden KEIN NextResponse (macht Probleme bei Routen)
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const client = url.searchParams.get("client") || "";
    const name = url.searchParams.get("name") || "";
    const therapist = url.searchParams.get("therapist") || "";

    console.log("Therapist response:", action, client, name, therapist);

    // ✅ Helper: korrekter Redirect in API Route
    const redirect = (target) =>
      new Response(null, {
        status: 302,
        headers: {
          Location: target,
        },
      });

    // ✅ Termin bestätigen
    if (action === "confirm") {
      return redirect(
        `https://poiseconnect.vercel.app/?resume=confirmed&email=${encodeURIComponent(client)}`
      );
    }

    // ✅ neuer Termin, gleiche Begleitung
    if (action === "rebook_same") {
      return redirect(
        `https://poiseconnect.vercel.app/?resume=10&email=${encodeURIComponent(
          client
        )}&therapist=${encodeURIComponent(therapist)}`
      );
    }

    // ✅ anderes Teammitglied wählen
    if (action === "rebook_other") {
      return redirect(
        `https://poiseconnect.vercel.app/?resume=5&email=${encodeURIComponent(client)}`
      );
    }

    // ✅ unbekannte Aktion
    return new Response(
      JSON.stringify({ ok: false, error: "UNKNOWN_ACTION" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("THERAPIST RESPONSE ERROR:", err);

    return new Response(
      JSON.stringify({ ok: false, error: "SERVER_ERROR" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
