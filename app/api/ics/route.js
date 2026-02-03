export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return new Response("Missing url", { status: 400 });
    }

    const target = new URL(url);

    // 🔒 Sicherheits-Check
if (
  target.protocol !== "https:" ||
  !(
    target.hostname === "calendar.google.com" ||
    target.hostname.endsWith("googleusercontent.com")
  )
) {
  return new Response("Forbidden", { status: 403 });
}

    const upstream = await fetch(target.href, {
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "text/calendar,*/*",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return new Response(
        `Upstream failed: ${upstream.status}`,
        { status: 502 }
      );
    }

    const text = await upstream.text();

    return new Response(text, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return new Response(
      "ICS proxy error: " + String(err),
      { status: 500 }
    );
  }
}
