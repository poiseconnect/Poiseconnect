// app/api/update-status/route.js
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
    const { anfrageId, status } = body || {};

    if (!anfrageId || !status) {
      return NextResponse.json(
        { error: "anfrageId oder status fehlt" },
        { status: 400 }
      );
    }

    // -----------------------------
    // 🔒 STATUS-REGELN ABSICHERN
    // -----------------------------

    // Papierkorb → nur wenn KEINE Sitzungen existieren
    if (status === "papierkorb") {
      const { count, error: countError } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("anfrage_id", anfrageId);

      if (countError) {
        console.error("Session count error:", countError);
        return NextResponse.json(
          { error: "SESSION_CHECK_FAILED" },
          { status: 500 }
        );
      }

      if (count > 0) {
        return NextResponse.json(
          {
            error:
              "PAPIERKORB_NICHT_ERLAUBT_BEI_BESTEHENDEN_SITZUNGEN",
          },
          { status: 400 }
        );
      }
    }

    // Beendet → nur wenn Sitzungen existieren
    if (status === "beendet") {
      const { count, error: countError } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("anfrage_id", anfrageId);

      if (countError) {
        console.error("Session count error:", countError);
        return NextResponse.json(
          { error: "SESSION_CHECK_FAILED" },
          { status: 500 }
        );
      }

      if (!count || count === 0) {
        return NextResponse.json(
          {
            error:
              "BEENDET_NUR_ERLAUBT_WENN_SITZUNGEN_EXISTIEREN",
          },
          { status: 400 }
        );
      }
    }

    // -----------------------------
    // ✅ STATUS UPDATE
    // -----------------------------
    const { error } = await supabase
      .from("anfragen")
      .update({ status })
      .eq("id", anfrageId);

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("update-status error:", err);
    return NextResponse.json(
      { error: "Status konnte nicht aktualisiert werden" },
      { status: 500 }
    );
  }
}
