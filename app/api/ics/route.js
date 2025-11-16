import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const icsUrl = url.searchParams.get("url");

    if (!icsUrl) {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 });
    }

    const res = await fetch(icsUrl, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json({ error: "Error fetching ICS" }, { status: 500 });
    }

    const text = await res.text();

    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": "text/calendar" },
    });

  } catch (err) {
    console.error("ICS ERROR:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err.toString() },
      { status: 500 }
    );
  }
}
