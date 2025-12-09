export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return NextResponse.redirect("https://poiseconnect.vercel.app/login");
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Session holen
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data?.session?.user) {
      console.error("Callback error:", error);
      return NextResponse.redirect("https://poiseconnect.vercel.app/login");
    }

    const email = data.session.user.email?.toLowerCase();

    // Team-Mails
    const teamEmails = [
      "hallo@mypoise.de",
      "support@mypoise.de",
      "linda@mypoise.de",
      "anna@mypoise.de",
      "ann@mypoise.de",
    ];

    if (teamEmails.includes(email)) {
      return NextResponse.redirect("https://poiseconnect.vercel.app/dashboard");
    }

    // Alle anderen → Startseite
    return NextResponse.redirect("https://poiseconnect.vercel.app/");
  } catch (err) {
    console.error("Callback crash:", err);
    return NextResponse.redirect("https://poiseconnect.vercel.app/login");
  }
}
