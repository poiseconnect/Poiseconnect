export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { anfrageId, newTherapist } = body || {};

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

    if (error) {
      console.error("REASSIGN UPDATE ERROR:", error);
      return NextResponse.json(
        { error: "update_failed", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("REASSIGN SERVER ERROR:", err);
    return NextResponse.json(
      { error: "Therapeut konnte nicht gewechselt werden" },
      { status: 500 }
    );
  }
}
