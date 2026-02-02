import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // 🔥 DAS WAR DER FEHLER

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "Missing ICS url" },
        { status: 400 }
      );
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("ICS FETCH FAILED:", res.status, url);
      return NextResponse.json(
        { error: "ICS fetch failed" },
        { status: 500 }
      );
    }

    const text = await res.text();

    console.log("✅ ICS LOADED:", text.length);

    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
      },
    });
  } catch (err) {
    console.error("❌ ICS API ERROR:", err);
    return NextResponse.json(
      { error: "ICS server error" },
      { status: 500 }
    );
  }
}
