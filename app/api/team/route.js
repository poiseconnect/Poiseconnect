export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

/**
 * Lädt das Google-Sheet (CSV) aus der Umgebungsvariable
 * POISE_TEAM_SHEET_URL und gibt ein Array von Objekten zurück.
 */
export async function GET() {
  const url = process.env.POISE_TEAM_SHEET_URL;

  if (!url) {
    return NextResponse.json(
      { error: "POISE_TEAM_SHEET_URL ist nicht gesetzt." },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "Content-Type": "text/plain",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Google Sheet Fehler: ${res.status}` },
        { status: 500 }
      );
    }

    const csv = await res.text();

    // CSV → Zeilen splitten
    const rows = csv
      .split("\n")
      .map((r) => r.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)); // CSV mit Kommas in Zitaten

    const header = rows.shift().map((h) => h.trim());

    const list = rows
      .filter((r) => r.length >= header.length)
      .map((row) => {
        const obj = {};
        header.forEach((h, i) => {
          let value = row[i] || "";
          value = value.replace(/^"|"$/g, "").trim(); // Anführungszeichen entfernen
          obj[h] = value;
        });
        return obj;
      });

    return NextResponse.json(list);
  } catch (err) {
    console.error("Team API Fehler:", err);
    return NextResponse.json(
      { error: "Serverfehler beim Laden des Team-Sheets" },
      { status: 500 }
    );
  }
}
