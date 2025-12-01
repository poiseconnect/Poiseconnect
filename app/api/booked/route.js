export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// -----------------------------------------------------
// Supabase nur dynamisch erzeugen, wie bei therapist-response
// -----------------------------------------------------
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // SERVICE ROLE KEY

  if (!url || !key) {
    console.error("❌ Supabase ENV fehlt:", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }

  return createClient(url, key);
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const therapist = url.searchParams.get("therapist");

    if (!therapist) {
      return NextResponse.json(
        { error: "Missing therapist" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "SUPABASE_NOT_CONFIGURED" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("confirmed_appointments")
      .select("termin_iso")
      .eq("therapist", therapist);

    if (error) {
      console.error("❌ Supabase Load Error:", error);
      return NextResponse.json(
        { error: "DB_ERROR", detail: error.message },
        { status: 500 }
      );
    }

    // normalisieren → Array von ISO-Strings
    const slots = (data || [])
      .map((row) => row.termin_iso)
      .filter(Boolean);

    return NextResponse.json({ slots }, { status: 200 });

  } catch (err) {
    console.error("❌ BOOKED API ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
