import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();

    const anfrageId = body?.anfrageId;
    const tarif = body?.tarif;

    if (!anfrageId) {
      return NextResponse.json(
        { error: "MISSING_ANFRAGE_ID" },
        { status: 400 }
      );
    }

    if (tarif === undefined || tarif === null || isNaN(Number(tarif))) {
      return NextResponse.json(
        { error: "INVALID_TARIF" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anfragen")
      .update({ honorar_klient: Number(tarif) })
      .eq("id", anfrageId);

    if (error) {
      console.error("SUPABASE UPDATE ERROR", error);
      return NextResponse.json(
        { error: "DB_UPDATE_FAILED", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("UPDATE TARIF SERVER ERROR", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
