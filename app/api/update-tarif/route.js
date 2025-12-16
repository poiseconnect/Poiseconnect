import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function POST(request) {
  try {
    const { anfrageId, tarif } = await request.json();

    if (!anfrageId || tarif == null) {
      return NextResponse.json(
        { error: "Ungültige Daten" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anfragen")
      .update({ honorar_klient: Number(tarif) })
      .eq("id", anfrageId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
