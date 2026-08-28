

export const dynamic = "force-dynamic";


import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// -----------------------------------------
// 🔧 Supabase SERVER Client (wie batch)
// -----------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// -----------------------------------------
// 🚀 POST: MATCH CLIENT
// -----------------------------------------
export async function POST(req) {
  try {
    const body = await req.json(); // ✅ genau ein json()
    console.log("MATCH CLIENT REQUEST RECEIVED");


    const { anfrageId, therapistEmail, honorar } = body || {};

    if (!anfrageId) {
      return NextResponse.json(
        { error: "anfrageId fehlt" },
        { status: 400 }
      );
    }

    // 1️⃣ Status prüfen
    const { data: anfrage, error } = await supabase
      .from("anfragen")
      .select("status")
      .eq("id", anfrageId)
      .single();

    if (error || !anfrage) {
      return NextResponse.json(
        { error: "Anfrage nicht gefunden" },
        { status: 404 }
      );
    }
const rawStatus = String(anfrage.status || "");

const normalizedStatus = rawStatus
  .toLowerCase()
  .trim()
  .replace("ä", "ae")
  .replace(/\s+/g, "_");

console.log("🔍 MATCH STATUS CHECK:", {
  rawStatus,
  normalizedStatus,
});

if (!normalizedStatus.includes("termin")) {
  return NextResponse.json(
    {
      error: "MATCH_NOT_ALLOWED",
      currentStatus: rawStatus,
      normalizedStatus,
    },
    { status: 400 }
  );
}
 console.log("🟡 STATUS OK – UPDATE TO ACTIVE");

    // 2️⃣ Anfrage aktiv setzen
    const { error: updateError } = await supabase
      .from("anfragen")
      .update({
        status: "active",
        honorar_klient: honorar ?? null,
      })
      .eq("id", anfrageId);

    if (updateError) {
      console.error("MATCH UPDATE ERROR:", { code: updateError?.code || null });
      return NextResponse.json(
        { error: "UPDATE_FAILED", detail: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }
    console.log("✅ MATCH UPDATE DONE");
return new Response(
  JSON.stringify({ ok: true }),
  {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }
);

  } catch (err) {
    console.error("MATCH CLIENT ERROR");
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
