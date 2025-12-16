import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export async function POST(req) {
  try {
    const { anfrageId, newTherapist } = await req.json();

    if (!anfrageId || !newTherapist) {
      return NextResponse.json(
        { error: "Daten fehlen" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anfragen")
      .update({ wunschtherapeut: newTherapist })
      .eq("id", anfrageId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("reassign-request error:", err);
    return NextResponse.json(
      { error: "Therapeut konnte nicht gewechselt werden" },
      { status: 500 }
    );
  }
}
