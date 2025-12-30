// app/api/update-status/route.js
import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function POST(req) {
  try {
    const body = await req.json();
    const { anfrageId, status } = body;

    if (!anfrageId || !status) {
      return NextResponse.json(
        { error: "anfrageId oder status fehlt" },
        { status: 400 }
      );
    }

    // -----------------------------
    // 🔒 STATUS-REGELN ABSICHERN
    // -----------------------------

    // ❌ Papierkorb NUR erlaubt, wenn KEINE Sitzungen existieren
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

    // ❌ Beendet NUR erlaubt, wenn Sitzungen existieren
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
