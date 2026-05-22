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

    const {
      anfrageId,
      invoice_with_vat,
    } = body || {};

    if (
      !anfrageId ||
      typeof invoice_with_vat !== "boolean"
    ) {
      return NextResponse.json(
        { error: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("anfragen")
      .update({
        invoice_with_vat,
      })
      .eq("id", anfrageId);

    if (error) {
      console.error(error);

      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });

  } catch (e) {
    console.error(e);

    return NextResponse.json(
      {
        error: "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
