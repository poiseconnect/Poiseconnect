import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* =========================================================
   SUPABASE (Service Role – Server only)
========================================================= */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* =========================================================
   POST /api/update-tarif
========================================================= */

export async function POST(req) {
  try {
    const body = await req.json();
    const { anfrageId, tarif } = body;

    // ---------- VALIDIERUNG ----------
    if (!anfrageId) {
      return NextResponse.json(
        { error: "Missing anfrageId" },
        { status: 400 }
      );
    }

    // ---------- UPDATE ----------
    const { error } = await supabase
      .from("anfragen")
      .update({
        honorar_klient: Number(tarif) || null,
      })
      .eq("id", anfrageId);

    if (error) {
      console.error("UPDATE TARIF DB ERROR:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // ---------- OK ----------
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("UPDATE TARIF SERVER ERROR:", err);
    return NextResponse.json(
      { error: "Serverfehler beim Aktualisieren des Tarifs" },
      { status: 500 }
    );
  }
}
