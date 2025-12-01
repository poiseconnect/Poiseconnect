import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ⚠️ Supabase NICHT global erstellen!
// Immer in einer Funktion – sonst crasht der Build.
function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY; 

  if (!url || !key) {
    console.error("❌ Supabase ENV fehlt:", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }

  return createClient(url, key);
}

export async function POST(req) {
  try {
    const body = await req.json();

    const supabase = getSupabaseServer();
    if (!supabase) {
      return NextResponse.json(
        { error: "SUPABASE_NOT_CONFIGURED" },
        { status: 500 }
      );
    }

    // Beispiel: Insert der Anfrage
    const { error } = await supabase.from("requests").insert(body);

    if (error) {
      console.error("DB ERROR:", error);
      return NextResponse.json({ error: "DB_INSERT_FAILED" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
