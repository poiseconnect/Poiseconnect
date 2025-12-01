export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { id, therapist, terminISO } = body;

    if (!id || !therapist || !terminISO) {
      return NextResponse.json(
        { error: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    // 1) Termin blockieren
    await supabase.from("confirmed_appointments").insert({
      therapist,
      termin_iso: terminISO,
    });

    // 2) Anfrage updaten
    await supabase
      .from("anfragen")
      .update({ status: "bestätigt" })
      .eq("id", id);

    // 3) (optional) Email an Klient → später
    console.log("EMAIL TO CLIENT: Termin bestätigt");

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
