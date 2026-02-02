// app/api/ics/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "missing_url" }, { status: 400 });
    }

    // Basic SSRF-Schutz: nur Google Calendar ICS erlauben
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    const allowedHosts = new Set([
      "calendar.google.com",
      "www.google.com",
    ]);

    if (!allowedHosts.has(host)) {
      return NextResponse.json(
        { error: "host_not_allowed", host },
        { status: 400 }
      );
    }

    // Abrufen (mit brauchbaren Headers)
    const upstream = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "text/calendar,text/plain,*/*",
        "User-Agent":
          "Mozilla/5.0 (compatible; PoiseConnect/1.0; +https://poiseconnect.vercel.app)",
      },
      // next: { revalidate: 0 } // optional
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      // Wichtig: Fehler transparent zurückgeben (damit du ihn siehst)
      return NextResponse.json(
        {
          error: "upstream_failed",
          status: upstream.status,
          statusText: upstream.statusText,
          // kurz halten, damit Logs/Responses nicht explodieren
          bodyPreview: text.slice(0, 300),
        },
        { status: 502 }
      );
    }

    // ICS zurückgeben
    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "ics_proxy_error", message: String(err?.message || err) },
      { status: 500 }
    );
  }
}
