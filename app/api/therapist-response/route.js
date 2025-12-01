export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// -----------------------------
// Supabase nur dynamisch bauen
// -----------------------------
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // ✅ FIX: richtige Variable

  if (!url || !key) {
    console.error("❌ Supabase ENV fehlt:", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }

  return createClient(url, key);
}

export async function GET(req) {
  try {
    const url = new URL(req.url);

    const action = url.searchParams.get("action");
    const client = url.searchParams.get("client");
    const therapist = url.searchParams.get("therapist");
    const slot = url.searchParams.get("slot");

    console.log("Therapist response:", { action, client, therapist, slot });

    const supabase = getSupabase();

    // ----------------------------------------------------
    // 1️⃣ TERMIN BESTÄTIGEN
    // ----------------------------------------------------
    if (action === "confirm") {
      if (!therapist || !slot) {
        return NextResponse.json(
          { error: "Missing therapist or slot" },
          { status: 400 }
        );
      }

      if (!supabase) {
        return NextResponse.json(
          { error: "SUPABASE_NOT_CONFIGURED" },
          { status: 500 }
        );
      }

      const { error } = await supabase
        .from("confirmed_appointments")
        .insert({
          therapist,
          client_email: client || null,
          termin_iso: slot,
        });

      if (error) {
        console.error("❌ Supabase INSERT ERROR:", error);
        return NextResponse.json(
          { error: "DB_INSERT_FAILED", detail: error.message },
          { status: 500 }
        );
      }

      // Termin bestätigt → Formular Step = confirmed
      return NextResponse.redirect(
        `https://mypoise.de/?resume=confirmed&email=${encodeURIComponent(
          client || ""
        )}`
      );
    }

    // ----------------------------------------------------
    // 2️⃣ GLEICHER THERAPEUT – Neuer Termin
    // ----------------------------------------------------
    if (action === "rebook_same") {
      return NextResponse.redirect(
        `https://mypoise.de/?resume=10&email=${encodeURIComponent(
          client || ""
        )}&therapist=${encodeURIComponent(therapist || "")}`
      );
    }

    // ----------------------------------------------------
    // 3️⃣ ANDERES TEAMMITGLIED WÄHLEN
    // ----------------------------------------------------
    if (action === "rebook_other") {
      return NextResponse.redirect(
        `https://mypoise.de/?resume=5&email=${encodeURIComponent(client || "")}`
      );
    }

    // ----------------------------------------------------
    // UNKNOWN ACTION
    // ----------------------------------------------------
    return NextResponse.json(
      { error: "UNKNOWN_ACTION" },
      { status: 400 }
    );

  } catch (err) {
    console.error("❌ THERAPIST RESPONSE ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
