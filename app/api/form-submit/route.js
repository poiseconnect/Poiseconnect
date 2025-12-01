export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ SUPABASE ENV FEHLT:", {
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

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "SUPABASE_NOT_CONFIGURED" },
        { status: 500 }
      );
    }

    const { error } = await supabase.from("anfragen").insert({
      vorname: body.vorname,
      nachname: body.nachname,
      email: body.email,
      strasse_hausnr: body.adresse || "",
      plz_ort: body.plz_ort || "",
      geburtsdatum: body.geburtsdatum,
      beschaeftigungsgrad: body.beschaeftigungsgrad,
      leidensdruck: body.leidensdruck || "",
      anliegen: body.anliegen,
      verlauf: body.verlauf,
      ziel: body.ziel,
      wunschtherapeut: body.wunschtherapeut,
      bevorzugte_zeit: body.terminDisplay || "",

      check_suizid: body.check_gesundheit || false,
      check_datenschutz: body.check_datenschutz || false,

      // FIX: richtige Spalte!
      check_online: body.check_online_setting || false,
    });

    if (error) {
      console.error("❌ DB ERROR:", error);
      return NextResponse.json(
        { error: "DB_INSERT_FAILED", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
