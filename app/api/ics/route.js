import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const icsUrl = url.searchParams.get("url");

    if (!icsUrl) {
      return NextResponse.json(
        { error: "Missing URL" },
        { status: 400 }
      );
    }

    const res = await fetch(icsUrl, {
      cache: "no-store",
      headers: {
        // 🔴 WICHTIG: Google blockt ohne Browser-Header
        "User-Agent": "Mozilla/5.0 (PoiseConnect)",
        "Accept": "text/calendar,text/plain,*/*",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("ICS FETCH FAILED", res.status, text);

      return NextResponse.json(
        {
          error: "Error fetching ICS",
          status: res.status,
        },
        { status: 500 }
      );
    }

    const text = await res.text();

    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });

  } catch (err) {
    console.error("ICS API ERROR:", err);

    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: String(err),
      },
      { status: 500 }
    );
  }
}
