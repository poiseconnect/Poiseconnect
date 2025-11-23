export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const action = searchParams.get("action");
    const client = searchParams.get("client");
    const name = searchParams.get("name");

    console.log("Therapist response:", action, client, name);

    function redirect(url) {
      return new Response(null, {
        status: 302,
        headers: { Location: url }
      });
    }

    if (action === "confirm") {
      return redirect(
        `https://poiseconnect.vercel.app/?resume=confirmed&email=${encodeURIComponent(client)}`
      );
    }

    if (action === "rebook_same") {
      return redirect(
        `https://poiseconnect.vercel.app/?resume=10&email=${encodeURIComponent(client)}`
      );
    }

    if (action === "rebook_other") {
      return redirect(
        `https://poiseconnect.vercel.app/?resume=5&email=${encodeURIComponent(client)}`
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: "UNKNOWN_ACTION" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("THERAPIST RESPONSE ERROR:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "SERVER_ERROR" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
