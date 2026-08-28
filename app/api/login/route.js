import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "NO_EMAIL" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Magic Link senden
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // 🔥 Der einzig korrekte Callback:
        emailRedirectTo: "https://app.mypoise.de/auth/callback",
      },
    });

    if (error) {
      console.error("Magic Link Error:", { code: error?.code || null });
      return NextResponse.json(
        { error: "SEND_FAILED", detail: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Login Route Error");
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
