import { NextResponse } from "next/server";

export async function GET(request) {
  // Supabase liest den Token aus der URL (#access_token=...)
  // und setzt automatisch ein Cookie — wir müssen nur weiterleiten
  return NextResponse.redirect("https://poiseconnect.vercel.app/dashboard");
}
