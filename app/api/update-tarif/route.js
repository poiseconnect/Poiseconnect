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
    const { anfrageId, tarif } = body || {};

    if (!anfrageId) {
      return NextResponse.json(
        { error: "MISSING_ANFRAGE_ID" },
        { status: 400 }
      );
    }

    const parsedTarif = Number(tarif);

    if (!Number.isFinite(parsedTarif) || parsedTarif <= 0) {
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
      console.error("UPDATE TARIF ERROR", error);
      return NextResponse.json(
        { error: error.message },
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
