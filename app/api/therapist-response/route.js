// app/api/therapist-response/route.js
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase Client (Server)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const clientEmail = url.searchParams.get("client");
    const therapist = url.searchParams.get("therapist");
    const terminISO = url.searchParams.get("termin");

    console.log("Therapist response:", action, clientEmail, therapist, terminISO);

    // -------------------------
    // 1) TERMIN BESTÄTIGEN
    // -------------------------
    if (action === "confirm") {
      if (!clientEmail || !therapist || !terminISO) {
        console.error("Missing data for confirm()");
        return NextResponse.json({ error: "Missing data" }, { status: 400 });
      }

      // In Supabase speichern
      const { error } = await supabase
        .from("confirmed_appointments")
        .insert({
          therapist,
          client_email: clientEmail,
          termin_iso: terminISO,
        });

      if (error) {
        console.error("Supabase insert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // redirect → Termin bestätigt
      return NextResponse.redirect(
        `https://mypoise.de/?resume=confirmed&email=${encodeURIComponent(clientEmail)}`
      );
    }

    // -------------------------
    // 2) NEUER TERMIN — gleiche Begleitung
    // -------------------------
    if (action === "rebook_same") {
      return NextResponse.redirect(
        `https://mypoise.de/?resume=10&email=${encodeURIComponent(clientEmail)}&therapist=${encodeURIComponent(therapist)}`
      );
    }

    // -------------------------
    // 3) Anderes Teammitglied wählen
    // -------------------------
    if (action === "rebook_other") {
      return NextResponse.redirect(
        `https://mypoise.de/?resume=5&email=${encodeURIComponent(clientEmail)}`
      );
    }

    // -------------------------
    // Fallback
    // -------------------------
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  } catch (err) {
    console.error("THERAPIST RESPONSE ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
