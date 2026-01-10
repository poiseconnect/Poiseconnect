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
    const { anfrageId } = body || {};

    if (!anfrageId) {
      return NextResponse.json(
        { error: "missing_anfrageId" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anfragen")
      .update({ status: "beendet" })
      .eq("id", anfrageId);

    if (error) {
      console.error("FINISH ERROR:", error);
      return NextResponse.json(
        { error: "update_failed", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("FINISH SERVER ERROR:", err);
    return NextResponse.json(
      { error: "server_error", detail: String(err) },
      { status: 500 }
    );
  }
}
