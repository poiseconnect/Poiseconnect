
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req) {
  try {
    const url = req.nextUrl.searchParams.get("url");
    if (!url) {
      return Response.json({ error: "missing url" }, { status: 400 });
    }

    let target;
    try {
      target = new URL(url);
    } catch {
      return Response.json({ error: "invalid url" }, { status: 400 });
    }

    // Sicherheits-Whitelist: nur Google Calendar ICS
    if (target.protocol !== "https:") {
      return Response.json({ error: "only https allowed" }, { status: 400 });
    }
    if (target.hostname !== "calendar.google.com") {
      return Response.json({ error: "host not allowed" }, { status: 403 });
    }

    const upstream = await fetch(target.toString(), {
      cache: "no-store",
      headers: {
        "accept": "text/calendar,*/*",
        // manche Upstreams reagieren ohne UA zickig
        "user-agent": "Mozilla/5.0 (PoiseConnect ICS Proxy)",
      },
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      return Response.json(
        {
          error: "upstream_failed",
          upstream_status: upstream.status,
          sample: text.slice(0, 300),
        },
        { status: 502 }
      );
    }

    return new Response(text, {
  status: 200,
  headers: {
    "content-type": "text/calendar; charset=utf-8",

    // 🔑 CORS – DAS FEHLT DIR
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type",

    // optional
    "cache-control": "no-store",
  },
});
  } catch (e) {
    return Response.json(
      { error: "ics_proxy_failed", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
