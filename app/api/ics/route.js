// app/api/ics/route.js
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // 🔴 WICHTIG: NICHT edge!

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url", { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return new NextResponse(
        `ICS fetch failed (${res.status})`,
        { status: 500 }
      );
    }

    const text = await res.text();

    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return new NextResponse(
      "ICS proxy error: " + err.message,
      { status: 500 }
    );
  }
}
