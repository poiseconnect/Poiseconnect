// app/api/update-status/route.js
import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function POST(req) {
  try {
    const body = await req.json();
    const { anfrageId, status } = body;

    if (!anfrageId || !status) {
      return NextResponse.json(
        { error: "anfrageId oder status fehlt" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anfragen")
      .update({ status })
      .eq("id", anfrageId);

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("update-status error:", err);
    return NextResponse.json(
      { error: "Status konnte nicht aktualisiert werden" },
      { status: 500 }
    );
  }
}
