export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ❗ KEIN createClient am Top-Level!
// Wir kapseln das in eine Funktion, damit beim Build nichts crasht.
function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY; // Service Role Key

  if (!url || !key) {
    console.error("Supabase env fehlt:", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null; // wir geben null zurück und behandeln das unten
  }

  return createClient(url, key);
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const client = url.searchParams.get("client");      // E-Mail des Klienten
    const name = url.searchParams.get("name");          // Vorname Klient (optional)
    const therapist = url.searchParams.get("therapist");// Name Begleitung
    const slot = url.searchParams.get("slot");          // ISO-String Termin

    console.log("Therapist response:", action, client, therapist, slot);

    // Für Aktionen, die Supabase brauchen, erst Client holen:
    const supabase = getSupabaseServer();

    // ------------------------------
    // 1️⃣ TERMIN BESTÄTIGEN
    // ------------------------------
    if (action === "confirm") {
      if (!therapist || !slot) {
        return NextResponse.json(
          { error: "Missing therapist or slot" },
          { status: 400 }
        );
      }

      if (!supabase) {
        // Env fehlt → 500, aber Build crasht nicht mehr
        return NextResponse.json(
          { error: "SUPABASE_NOT_CONFIGURED" },
          { status: 500 }
        );
      }

      const { error } = await supabase
        .from("confirmed_appointments")
        .insert({
          therapist,
          termin_iso: slot,
        });

      if (error) {
        console.error("Supabase INSERT ERROR:", error);
        return NextResponse.json(
          { error: "DB_INSERT_FAILED" },
          { status: 500 }
        );
      }

      // Redirect zurück zum Formular – Termin bestätigt
      return NextResponse.redirect(
        `https://mypoise.de/?resume=confirmed&email=${encodeURIComponent(
          client || ""
        )}`
      );
    }

    // ------------------------------
    // 2️⃣ NEUER TERMIN / GLEICHER THERAPEUT
    // ------------------------------
    if (action === "rebook_same") {
      return NextResponse.redirect(
        `https://mypoise.de/?resume=10&email=${encodeURIComponent(
          client || ""
        )}&therapist=${encodeURIComponent(therapist || "")}`
      );
    }

    // ------------------------------
    // 3️⃣ ANDERES TEAMMITGLIED
    // ------------------------------
    if (action === "rebook_other") {
      return NextResponse.redirect(
        `https://mypoise.de/?resume=5&email=${encodeURIComponent(client || "")}`
      );
    }

    return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (err) {
    console.error("THERAPIST RESPONSE ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
