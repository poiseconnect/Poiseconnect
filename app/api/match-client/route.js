

export const dynamic = "force-dynamic";


import { NextResponse } from "next/server";
import {
  canAccessAssignedRequest,
  getActiveTeamMember,
} from "../_lib/server";

// -----------------------------------------
// 🔧 Supabase SERVER Client (wie batch)
// -----------------------------------------
// -----------------------------------------
// 🚀 POST: MATCH CLIENT
// -----------------------------------------
export async function POST(req) {
  try {
    const body = await req.json(); // ✅ genau ein json()
    const auth = await getActiveTeamMember(req);
    if (!auth.member) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { anfrageId } = body || {};

    if (!anfrageId) {
      return NextResponse.json(
        { error: "anfrageId fehlt" },
        { status: 400 }
      );
    }

    // 1️⃣ Status prüfen
    const { data: anfrage, error } = await auth.supabase
      .from("anfragen")
      .select("status, assigned_therapist_id")
      .eq("id", anfrageId)
      .single();

    if (error || !anfrage) {
      return NextResponse.json(
        { error: "Anfrage nicht gefunden" },
        { status: 404 }
      );
    }

    if (!canAccessAssignedRequest(auth.member, anfrage.assigned_therapist_id)) {
      return NextResponse.json({ error: "NO_ACCESS" }, { status: 403 });
    }
const rawStatus = String(anfrage.status || "");

const normalizedStatus = rawStatus
  .toLowerCase()
  .trim()
  .replace("ä", "ae")
  .replace(/\s+/g, "_");

if (!normalizedStatus.includes("termin")) {
  return NextResponse.json(
    {
      error: "MATCH_NOT_ALLOWED",
    },
    { status: 400 }
  );
}
    // 2️⃣ Anfrage aktiv setzen
    let update = auth.supabase
      .from("anfragen")
      .update({
        status: "active",
      })
      .eq("id", anfrageId);
    if (auth.member.role === "therapist") {
      update = update.eq("assigned_therapist_id", auth.member.id);
    }
    const { data: updated, error: updateError } = await update
      .select("id")
      .maybeSingle();

    if (updateError || !updated) {
      console.error("MATCH UPDATE ERROR:", { code: updateError?.code || null });
      return NextResponse.json(
        { error: "UPDATE_FAILED", detail: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }
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
