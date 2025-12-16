import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";


export async function POST(req) {
  try {
    const { anfrageId, tarif } = await req.json();

    if (!anfrageId || typeof tarif !== "number") {
      return NextResponse.json(
        { error: "Ungültige Daten" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anfragen")
      .update({ honorar_klient: tarif })
      .eq("id", anfrageId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("update-tarif error:", err);
    return NextResponse.json(
      { error: "Tarif konnte nicht gespeichert werden" },
      { status: 500 }
    );
  }
}
