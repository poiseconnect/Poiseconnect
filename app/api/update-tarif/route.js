export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// -----------------------------------------
// 🔧 Supabase SERVER Client (wie batch & match)
// -----------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// -----------------------------------------
// 🚀 POST: STUNDENSATZ AKTUALISIEREN
// -----------------------------------------
export async function POST(req) {
  try {
    const body = await req.json(); // ✅ genau ein json()

    const { anfrageId, tarif } = body || {};

    if (!anfrageId || tarif == null) {
      return NextResponse.json(
        { error: "Ungültige Daten" },
        { status: 400 }
      );
    }

    const parsedTarif = Number(tarif);
    if (isNaN(parsedTarif)) {
      return NextResponse.json(
        { error: "INVALID_TARIF" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anfragen")
      .update({ honorar_klient: parsedTarif })
      .eq("id", anfrageId);

    if (error) {
      console.error("UPDATE TARIF ERROR:", error);
      return NextResponse.json(
        { error: "UPDATE_FAILED", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("UPDATE TARIF SERVER ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
