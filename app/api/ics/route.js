import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
        // 🔑 WICHTIG für Google Calendar
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "ICS fetch failed", status: res.status },
        { status: 500 }
      );
    }

    const text = await res.text();

    // 🔍 Debug – du wirst DAS sehen
    console.log("ICS LENGTH:", text.length);

    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
      },
    });
  } catch (err) {
    console.error("ICS API ERROR:", err);
    return NextResponse.json(
      { error: "ICS server error" },
      { status: 500 }
    );
  }
}
