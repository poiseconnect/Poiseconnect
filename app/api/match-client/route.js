import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function POST(request) {
  try {
    // ✅ Request sauber parsen
    const body = await request.json();
    const { anfrageId, therapistEmail, honorar } = body;

    if (!anfrageId) {
      return NextResponse.json(
        { error: "anfrageId fehlt" },
        { status: 400 }
      );
    }

    // 1️⃣ Aktuellen Status laden
    const { data: anfrage, error: statusError } = await supabase
      .from("anfragen")
      .select("status")
      .eq("id", anfrageId)
      .single();

    if (statusError || !anfrage) {
      return NextResponse.json(
        { error: "Anfrage nicht gefunden" },
        { status: 404 }
      );
    }

    const status = String(anfrage.status || "").toLowerCase();

    // 2️⃣ Sicherheits-Gate
    const allowed = [
      "termin_bestaetigt",
      "termin bestätigt",
      "confirmed",
      "appointment_confirmed",
      "bestaetigt",
    ];

    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: "Match erst nach bestätigtem Ersttermin möglich" },
        { status: 400 }
      );
    }

    // 3️⃣ Anfrage aktiv setzen
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        status: "active",
        honorar_klient: honorar ?? null,
        wunschtherapeut: therapistEmail ?? null,
      })
      .eq("id", anfrageId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // ✅ SAUBERE RESPONSE
    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("MATCH CLIENT ERROR:", err);
    return NextResponse.json(
      { error: "Serverfehler", detail: err?.message },
      { status: 500 }
    );
  }
}
