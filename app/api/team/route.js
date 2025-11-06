export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.POISE_TEAM_SHEET_URL;

  try {
    const res = await fetch(url);
    const text = await res.text();

    const rows = text.split("\n").map((r) => r.split(","));
    const header = rows.shift();

    const list = rows.map((row) => {
      const obj = {};
      header.forEach((h, i) => (obj[h.trim()] = row[i]?.trim()));
      return obj;
    });

    return NextResponse.json(list);
  } catch (err) {
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}
