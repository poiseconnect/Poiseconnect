export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const therapist = searchParams.get("therapist");

    if (!therapist) {
      return NextResponse.json({ error: "Missing therapist" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("confirmed_appointments")
      .select("termin_iso")
      .eq("therapist", therapist);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
    }

    const slots = (data || []).map(r => r.termin_iso);

    return NextResponse.json({ slots }, { status: 200 });

  } catch (err) {
    console.error("CONFIRMED-SLOTS ERROR:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
