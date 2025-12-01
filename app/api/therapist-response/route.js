export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Client erst zur Laufzeit erzeugen
 * → verhindert Build-Fehler auf Vercel
 */
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.error("❌ SUPABASE ENV FEHLT:", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }

  return createClient(url, key);
}

// --------------------------------------------------------------------
// API ENTRY
// --------------------------------------------------------------------
export async function GET(req) {
  try {
    const url = new URL(req.url);

    const action = url.searchParams.get("action");       // confirm | rebook_same | rebook_other
    const email = url.searchParams.get("client") || "";  // Klient-Mail
    const therapist = url.searchParams.get("therapist"); // Name der Begleitung
    const slot = url.searchParams.get("slot");           // Termin ISO

    console.log("📨 Therapist Response:", { action, email, therapist, slot });

    const supabase = getSupabase(); // kann null sein

    // --------------------------------------------------------------
    // 1️⃣ TERMIN BESTÄTIGEN
    // --------------------------------------------------------------
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

      // In Supabase speichern (Tabelle: booked_appointments)
      const { error } = await supabase
        .from("booked_appointments")
        .insert({
          therapist,
          termin_iso: slot,
        });

      if (error) {
        console.error("❌ DB INSERT ERROR:", error);
        return NextResponse.json(
          { error: "DB_INSERT_FAILED" },
          { status: 500 }
        );
      }

      console.log("✅ Termin bestätigt und gespeichert");

      // Danach wieder zurück zum Poise-Formular
      return NextResponse.redirect(
        `https://mypoise.de/?resume=confirmed&email=${encodeURIComponent(email)}`
      );
    }

    // --------------------------------------------------------------
    // 2️⃣ NEUER TERMIN – GLEICHER THERAPEUT
    // --------------------------------------------------------------
    if (action === "rebook_same") {
      return NextResponse.redirect(
        `https://mypoise.de/?resume=10&email=${encodeURIComponent(email)}&therapist=${encodeURIComponent(therapist || "")}`
      );
    }

    // --------------------------------------------------------------
    // 3️⃣ ANDERES TEAMMITGLIED WÄHLEN
    // --------------------------------------------------------------
    if (action === "rebook_other") {
      return NextResponse.redirect(
        `https://mypoise.de/?resume=5&email=${encodeURIComponent(email)}`
      );
    }

    // --------------------------------------------------------------
    // ❓ Unbekannte Aktion
    // --------------------------------------------------------------
    return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });

  } catch (err) {
    console.error("❌ THERAPIST RESPONSE ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
