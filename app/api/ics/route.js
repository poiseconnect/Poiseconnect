// ⬇️ DAS IST DER ENTSCHEIDENDE SCHALTER
export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url", { status: 400 });
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/calendar,text/plain,*/*",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.error("ICS fetch failed:", res.status, res.statusText);
      return new NextResponse("ICS fetch failed", { status: 502 });
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
    console.error("ICS proxy error:", err);
    return new NextResponse("ICS proxy error", { status: 500 });
  }
}
