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

    // Supabase Server Client (mit Service Key)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Session erzeugen
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data?.session) {
      console.error("Callback error:", error);
      return NextResponse.redirect("https://poiseconnect.vercel.app/login");
    }

    const response = NextResponse.redirect(
      "https://poiseconnect.vercel.app/dashboard"
    );

    // Auth-Cookies setzen → extrem wichtig für iPhone!
    supabase.auth.setSession(data.session);

    // Cookies manuell setzen
    response.cookies.set("sb-access-token", data.session.access_token, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    });

    response.cookies.set("sb-refresh-token", data.session.refresh_token, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    });

    return response;
  } catch (err) {
    console.error("Callback crash:", err);
    return NextResponse.redirect("https://poiseconnect.vercel.app/login");
  }
}
