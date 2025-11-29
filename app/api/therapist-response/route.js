export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 🟢 Supabase SERVER-CLIENT (SERVICE KEY REQUIRED)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // MUSS gesetzt sein!
);

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const client = url.searchParams.get("client");
    const name = url.searchParams.get("name");         // Vorname
    const therapist = url.searchParams.get("therapist");
    const slot = url.searchParams.get("slot");         // terminISO für confirm

    console.log("Therapist response:", action, client, therapist, slot);

    // ------------------------------
    //    1️⃣ TERMIN BESTÄTIGEN
    // ------------------------------
    if (action === "confirm") {
      if (!therapist || !slot) {
        return NextResponse.json(
          { error: "Missing therapist or slot" },
          { status: 400 }
        );
      }

      // 🟢 Termin in Supabase eintragen
      const { error } = await supabase
        .from("confirmed_appointments")
        .insert({
          therapist,
          slot,
        });

      if (error) {
        console.error("Supabase INSERT ERROR:", error);
        return NextResponse.json(
          { error: "DB_INSERT_FAILED" },
          { status: 500 }
        );
      }

      // 🟢 Redirect zurück zum Formular
      return NextResponse.redirect(
        `https://mypoise.de/?resume=confirmed&email=${encodeURIComponent(client)}`
      );
    }

    // ------------------------------
    //    2️⃣ NEUER TERMIN / GLEICHER THERAPEUT
    // ------------------------------
    if (action === "rebook_same") {
      return NextResponse.redirect(
        `https://mypoise.de/?resume=10&email=${encodeURIComponent(client)}&therapist=${encodeURIComponent(therapist)}`
      );
    }

    // ------------------------------
    //    3️⃣ ANDERES TEAMMITGLIED
    // ------------------------------
    if (action === "rebook_other") {
      return NextResponse.redirect(
        `https://mypoise.de/?resume=5&email=${encodeURIComponent(client)}`
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
