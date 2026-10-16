export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET(req) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const allowedActions = new Set([
    "confirm",
    "reject",
    "rebook_same",
    "rebook_other",
  ]);

  if (!allowedActions.has(action)) {
    return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  }

  const origin = new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://app.mypoise.de"
  ).origin;
  return NextResponse.redirect(new URL("/dashboard", origin));
}
