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

    // Session tauschen
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data?.session?.user) {
      console.error("Callback error:", error);
      return NextResponse.redirect("https://poiseconnect.vercel.app/login");
    }

    const email = data.session.user.email.toLowerCase();

    const teamEmails = [
      "hallo@mypoise.de",
      "support@mypoise.de",
      "linda@mypoise.de",
      "anna@mypoise.de",
      "ann@mypoise.de",
    ];

    // 👇 Safari-/iPhone-sicherer Redirect
    const redirectUrl = teamEmails.includes(email)
      ? "https://poiseconnect.vercel.app/dashboard"
      : "https://poiseconnect.vercel.app/";

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl,
      },
    });
  } catch (err) {
    console.error("Callback crash:", err);
    return NextResponse.redirect("https://poiseconnect.vercel.app/login");
  }
}
