export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// erlaubte Stati
const ALLOWED_STATUS = [
  "offen",
  "termin_neu",
  "termin_bestaetigt",
  "active",
  "beendet",
  "papierkorb",
  "no_match",
  "abgelehnt",
  "weitergeleitet",
];

export async function POST(req) {
  try {
    const body = await req.json();
    const { anfrageId, status } = body;

    if (!anfrageId || !status || !ALLOWED_STATUS.includes(status)) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    // ------------------------------------------------
    // 🔒 REGEL: Papierkorb → NUR wenn KEINE Sitzungen
    // ------------------------------------------------
    if (status === "papierkorb") {
      const { count, error } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("anfrage_id", anfrageId);

      if (error) {
        console.error("SESSION COUNT ERROR:", error);
        return NextResponse.json(
          { error: "SESSION_CHECK_FAILED" },
          { status: 500 }
        );
      }

      if (Number(count) > 0) {
        return NextResponse.json(
          {
            error:
              "PAPIERKORB_NICHT_ERLAUBT_BEI_BESTEHENDEN_SITZUNGEN",
          },
          { status: 400 }
        );
      }
    }

    // ------------------------------------------------
    // 🔒 REGEL: Beendet → NUR wenn Sitzungen existieren
    // ------------------------------------------------
    if (status === "beendet") {
      const { count, error } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("anfrage_id", anfrageId);

      if (error) {
        console.error("SESSION COUNT ERROR:", error);
        return NextResponse.json(
          { error: "SESSION_CHECK_FAILED" },
          { status: 500 }
        );
      }

      if (!Number(count)) {
        return NextResponse.json(
          {
            error:
              "BEENDET_NUR_ERLAUBT_WENN_SITZUNGEN_EXISTIEREN",
          },
          { status: 400 }
        );
      }
    }

    // ------------------------------------------------
    // ✅ STATUS UPDATE
    // ------------------------------------------------
    const { error } = await supabase
      .from("anfragen")
      .update({ status })
      .eq("id", anfrageId);

    if (error) {
      console.error("STATUS UPDATE ERROR:", error);
      return NextResponse.json(
        { error: "DB_UPDATE_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("UPDATE STATUS SERVER ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
