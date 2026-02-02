// app/api/ics/route.js

export const runtime = "nodejs"; // 🔴 WICHTIG – NICHT EDGE

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return new Response("Missing url parameter", { status: 400 });
    }

    // 🔒 nur Google Calendar erlauben
    if (!url.startsWith("https://calendar.google.com/calendar/ical/")) {
      return new Response("Forbidden calendar host", { status: 403 });
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/calendar,text/plain,*/*",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("ICS upstream error:", res.status, txt.slice(0, 300));
      return new Response("Upstream calendar failed", { status: 502 });
    }

    const icsText = await res.text();

    return new Response(icsText, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("ICS API crash:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
