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
    const { anfrageId, tarif } = body;

    const numericTarif = Number(tarif);

    if (!anfrageId || !Number.isFinite(numericTarif)) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anfragen")
      .update({ honorar_klient: numericTarif })
      .eq("id", anfrageId);

    if (error) {
      console.error("SUPABASE UPDATE ERROR:", error);
      return NextResponse.json(
        { error: "DB_UPDATE_FAILED" },
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
