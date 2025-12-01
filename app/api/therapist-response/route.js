export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 👇 Hilfsfunktion, damit der Build nicht crasht
function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // <- GENAU SO heißt deine Variable

  if (!url || !key) {
    console.error("Supabase env fehlt:", {
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

    const client = url.searchParams.get("client");       // E-Mail der Klientin
    const name = url.searchParams.get("name");           // Klientenname (optional)
    const therapist = url.searchParams.get("therapist"); // z.B. "Ann"
    const slot = url.searchParams.get("slot");           // ISO-String des Termins

    console.log("Therapist response:", { action, client, therapist, slot });

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
        // Env nicht gesetzt → 500, aber kein Build-Fehler
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
          slot, // 👈 spaltenname in Supabase
        });

      if (error) {
        console.error("Supabase INSERT ERROR:", error);
        return NextResponse.json(
          { error: "DB_INSERT_FAILED" },
          { status: 500 }
        );
      }

      // ✅ Zurück zum Formular – Termin bestätigt
      return NextResponse.redirect(
        `https://mypoise.de/?resume=confirmed&email=${encodeURIComponent(
          client || ""
        )}`
      );
    }

    // ------------------------------
    // 2️⃣ NEUER TERMIN – GLEICHE BEGLEITUNG
    //    → alter Termin wieder freigeben
    // ------------------------------
    if (action === "rebook_same") {
      if (supabase && therapist && slot) {
        try {
          await supabase
            .from("confirmed_appointments")
            .delete()
            .eq("therapist", therapist)
            .eq("slot", slot);
        } catch (e) {
          console.error("Supabase DELETE (rebook_same) failed:", e);
        }
      }

      return NextResponse.redirect(
        `https://mypoise.de/?resume=10&email=${encodeURIComponent(
          client || ""
        )}&therapist=${encodeURIComponent(therapist || "")}`
      );
    }

    // ------------------------------
    // 3️⃣ ANDERES TEAMMITGLIED – alter Termin wieder frei
    // ------------------------------
    if (action === "rebook_other") {
      if (supabase && therapist && slot) {
        try {
          await supabase
            .from("confirmed_appointments")
            .delete()
            .eq("therapist", therapist)
            .eq("slot", slot);
        } catch (e) {
          console.error("Supabase DELETE (rebook_other) failed:", e);
        }
      }

      return NextResponse.redirect(
        `https://mypoise.de/?resume=5&email=${encodeURIComponent(client || "")}`
      );
    }

    // Unbekannte Aktion
    return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (err) {
    console.error("THERAPIST RESPONSE ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
