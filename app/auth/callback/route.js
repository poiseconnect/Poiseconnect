export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req) {
  console.log("📩 Callback reached");

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    console.log("➡️ Code received:", code);

    if (!code) {
      console.log("❌ No code found → redirect login");
      return NextResponse.redirect("https://poiseconnect.vercel.app/login");
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    console.log("🔌 Exchanging code for session…");

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.log("❌ exchange error:", error);
    }

    if (!data?.session?.user) {
      console.log("❌ No session.user after exchange");
      return NextResponse.redirect("https://poiseconnect.vercel.app/login");
    }

    console.log("✅ Session OK, user:", data.session.user.email);

    const email = data.session.user.email?.toLowerCase();

    if (email === "hallo@mypoise.de") {
      console.log("➡️ Routing to dashboard");
      return NextResponse.redirect("https://poiseconnect.vercel.app/dashboard");
    }

    console.log("➡️ Routing to homepage");
    return NextResponse.redirect("https://poiseconnect.vercel.app/");
    
  } catch (err) {
    console.log("💥 CRASH:", err);
    return NextResponse.redirect("https://poiseconnect.vercel.app/login");
  }
}
