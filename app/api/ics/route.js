// app/api/ics/route.js
import { NextResponse } from "next/server";

// Kalender-Map – hier weitere Mitglieder ergänzen
const ICS_BY_MEMBER = {
  Ann: "https://calendar.google.com/calendar/ical/75f62df4c63554a1436d49c3a381da84502728a0457c9c8b56d30e21fa5021c5%40group.calendar.google.com/public/basic.ics",
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const member = searchParams.get("member");
    const url = ICS_BY_MEMBER[member];

    if (!member || !url) {
      return NextResponse.json({ error: "Unknown member" }, { status: 400 });
    }

    // Server-seitig laden (kein CORS-Problem)
    const res = await fetch(`${url}?nocache=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: "Upstream ICS fetch failed" }, { status: 502 });
    }
    const text = await res.text();

    // ICS an den Client durchreichen
    return new NextResponse(text, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
