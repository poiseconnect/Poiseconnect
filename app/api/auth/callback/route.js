import { NextResponse } from "next/server";

export async function GET(req) {
  const next = req.nextUrl.searchParams.get("next") || "/dashboard";
  return NextResponse.redirect(next);
}
