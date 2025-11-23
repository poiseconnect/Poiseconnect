export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const action = searchParams.get("action");
    const client = searchParams.get("client");
    const name = searchParams.get("name");

    console.log("Therapist response:", action, client, name);

    // ⛔ Sicherheitscheck – fehlen Parameter?
    if (!action || !client) {
      return NextResponse.json(
        { ok: false, error: "MISSING_PARAMS" },
        { status: 400 }
      );
    }

    // ✅ Termin bestätigt
    if (action === "confirm") {
      return NextResponse.redirect(
        `https://poiseconnect.vercel.app/?resume=confirmed&email=${encodeURIComponent(client)}`
      );
    }

    // ✅ neuer Termin, gleiche Begleitung
    if (action === "rebook_same") {
      return NextResponse.redirect(
        `https://poiseconnect.vercel.app/?resume=10&email=${encodeURIComponent(client)}`
      );
    }

    // ✅ anderes Teammitglied wählen
    if (action === "rebook_other") {
      return NextResponse.redirect(
        `https://poiseconnect.vercel.app/?resume=5&email=${encodeURIComponent(client)}`
      );
    }

    // ✅ Unbekannte Aktion
    return NextResponse.json(
      { ok: false, error: "UNKNOWN_ACTION" },
      { status: 400 }
    );

  } catch (err) {
    console.error("THERAPIST RESPONSE ERROR:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
