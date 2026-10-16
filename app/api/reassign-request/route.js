export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getActiveTeamMember, json } from "../_lib/server";

export async function POST(request) {
  try {
    const auth = await getActiveTeamMember(request);
    if (!auth.member) return json({ error: auth.error }, auth.status);
    if (auth.member.role !== "admin") {
      return json({ error: "NO_ACCESS" }, 403);
    }

    const body = await request.json();
    const { anfrageId, newTherapist } = body || {};

    if (!anfrageId || !newTherapist) {
      return NextResponse.json(
        { error: "Daten fehlen" },
        { status: 400 }
      );
    }

    const { error } = await auth.supabase
      .from("anfragen")
      .update({ wunschtherapeut: newTherapist })
      .eq("id", anfrageId);

    if (error) {
      console.error("REASSIGN UPDATE ERROR:", { code: error?.code || null });
      return NextResponse.json(
        { error: "update_failed", detail: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("REASSIGN SERVER ERROR");
    return NextResponse.json(
      { error: "Therapeut konnte nicht gewechselt werden" },
      { status: 500 }
    );
  }
}
