export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { anfrageId, vat_mode, vat_country, vat_rate, vat_reason, user_email } = body || {};

    if (!anfrageId || !user_email) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: anfrage, error: fetchErr } = await supabase
      .from("anfragen")
      .select("id, wunschtherapeut")
      .eq("id", anfrageId)
      .single();

    if (fetchErr || !anfrage) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const isAdmin = user_email === "hallo@mypoise.de";
    const isOwner = anfrage.wunschtherapeut === user_email;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const mode = vat_mode || "exempt";
    const rate = mode === "taxable" ? Number(vat_rate || 0) : 0;

    const { error: updErr } = await supabase
      .from("anfragen")
      .update({
        vat_mode: mode,
        vat_country: vat_country || null,
        vat_rate: rate,
        vat_reason: vat_reason || null,
        vat_decided_by: user_email,
      })
      .eq("id", anfrageId);

    if (updErr) {
      console.error("update-client-vat error", updErr);
      return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("update-client-vat server error", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
