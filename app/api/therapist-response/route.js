export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";   // ✅ FEHLTE
// optional: console.log bleibt

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const action = searchParams.get("action");
    const client = searchParams.get("client");
    const therapist = searchParams.get("therapist");

    console.log("Therapist response:", action, client, therapist);

    // ✅ Termin bestätigen
    if (action === "confirm") {
      return NextResponse.redirect(
        `https://mypoise.de/?resume=confirmed&email=${encodeURIComponent(client)}`
      );
    }

    // ✅ neuer Termin, gleiche Begleitung
    if (action === "rebook_same") {
      return NextResponse.redirect(
        `https://poiseconnect.vercel.app/?resume=10&email=${encodeURIComponent(client)}&therapist=${encodeURIComponent(therapist)}`
      );
    }

    // ✅ anderes Teammitglied wählen
    if (action === "rebook_other") {
      return NextResponse.redirect(
        `https://poiseconnect.vercel.app/?resume=5&email=${encodeURIComponent(client)}`
      );
    }

    return NextResponse.json({ ok: false, error: "UNKNOWN_ACTION" }, { status: 400 });

  } catch (err) {
    console.error("THERAPIST RESPONSE ERROR:", err);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
