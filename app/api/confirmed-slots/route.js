export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase Client – wie in therapist-response
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // SERVICE KEY, nicht der public key
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const therapist = searchParams.get("therapist");

    if (!therapist) {
      return NextResponse.json(
        { error: "Missing therapist" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("confirmed_appointments")
      .select("slot")
      .eq("therapist", therapist);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "DB_ERROR" },
        { status: 500 }
      );
    }

    // Array von ISO-Strings
    const slots = (data || []).map((row) => row.slot);

    return NextResponse.json({ slots }, { status: 200 });
  } catch (err) {
    console.error("CONFIRMED-SLOTS ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
