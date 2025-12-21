import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function POST(request) {
  try {
    const body = await request.json(); // ✅ einzig erlaubter json-Call

    const { anfrageId, therapistEmail, honorar } = body || {};

    if (!anfrageId) {
      return NextResponse.json(
        { error: "anfrageId fehlt" },
        { status: 400 }
      );
    }

    const { data: anfrage, error } = await supabase
      .from("anfragen")
      .select("status")
      .eq("id", anfrageId)
      .single();

    if (error || !anfrage) {
      return NextResponse.json(
        { error: "Anfrage nicht gefunden" },
        { status: 404 }
      );
    }

    const status = String(anfrage.status || "").toLowerCase();

    if (!["confirmed", "termin_bestaetigt", "bestaetigt"].includes(status)) {
      return NextResponse.json(
        { error: "Match erst nach bestätigtem Termin erlaubt" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        status: "active",
        honorar_klient: honorar ?? null,
      })
      .eq("id", anfrageId);

    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("MATCH CLIENT ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
