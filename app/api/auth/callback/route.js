export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    // Kein Code → zurück zum Login
    if (!code) {
      return NextResponse.redirect("https://poiseconnect.vercel.app/login");
    }

    // Supabase Client (mit ANON Schlüssel, korrekt für Code-Exchange)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Code ↔ Session tauschen
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data?.session?.user) {
      console.error("Callback error:", error);
      return NextResponse.redirect("https://poiseconnect.vercel.app/login");
    }

    // User-Email
    const email = data.session.user.email?.toLowerCase();

    // Team-Mails → Dashboard
    const team = [
      "hallo@mypoise.de",
      "support@mypoise.de",
      "team@mypoise.de"
    ];

    if (team.includes(email)) {
      return NextResponse.redirect("https://poiseconnect.vercel.app/dashboard");
    }

    // Sonstige Nutzer → Startseite
    return NextResponse.redirect("https://poiseconnect.vercel.app/");
  } catch (err) {
    console.error("Callback crash:", err);
    return NextResponse.redirect("https://poiseconnect.vercel.app/login");
  }
}
