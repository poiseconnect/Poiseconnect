export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const icsUrl = searchParams.get("url");

    if (!icsUrl) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    const res = await fetch(icsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return new NextResponse(
        `ICS fetch failed: ${res.status}`,
        { status: 500 }
      );
    }

    const text = await res.text();

    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
      },
    });
  } catch (err) {
    console.error("ICS ERROR", err);
    return new NextResponse("ICS proxy error", { status: 500 });
  }
}
