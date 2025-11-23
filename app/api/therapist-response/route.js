export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET(request) {
  let url;

  try {
    url = new URL(request.url);
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_URL" }, { status: 400 });
  }

  const searchParams = url.searchParams;

  const action = searchParams.get("action");
  const client = searchParams.get("client") || "";
  const name = searchParams.get("name") || "";

  console.log("Therapist response:", action, client, name);

  // ✅ Termin bestätigen
  if (action === "confirm") {
    return NextResponse.redirect(
      `https://mypoise.de/?resume=confirmed&email=${encodeURIComponent(client)}`
    );
  }

  // ✅ neuer Termin, gleiche Begleitung
  if (action === "rebook_same") {
    return NextResponse.redirect(
      `https://mypoise.de/?resume=10&email=${encodeURIComponent(client)}`
    );
  }

  // ✅ anderes Teammitglied wählen
  if (action === "rebook_other") {
    return NextResponse.redirect(
      `https://mypoise.de/?resume=5&email=${encodeURIComponent(client)}`
    );
  }

  return NextResponse.json(
    { ok: false, error: "UNKNOWN_ACTION" },
    { status: 400 }
  );
}
