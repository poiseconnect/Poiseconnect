export async function GET(req) {
  try {
    const url = new URL(req.url);
    const icsUrl = url.searchParams.get("url");

    if (!icsUrl) {
      return new Response("Missing URL", { status: 400 });
    }

    const res = await fetch(icsUrl, { cache: "no-store" });

    if (!res.ok) {
      return new Response("Error fetching ICS", { status: 500 });
    }

    const text = await res.text();
    return new Response(text, {
      status: 200,
      headers: { "Content-Type": "text/calendar" }
    });

  } catch (err) {
    return new Response("Internal Server Error", { status: 500 });
  }
}
