export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ----------------------------
// SUPABASE SERVER CLIENT
// ----------------------------
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ SUPABASE ENV FEHLT:", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }

  return createClient(url, key);
}

// ----------------------------
// RESEND EMAIL CLIENT
// ----------------------------
async function sendEmail(to, subject, text) {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Poise <kontakt@mypoise.de>",
        to: [to],
        subject,
        text,
      }),
    });
  } catch (err) {
    console.error("❌ EMAIL FEHLER:", err);
  }
}

// ----------------------------
// API ROUTE
// ----------------------------
export async function GET(req) {
  try {
    const url = new URL(req.url);

    const action = url.searchParams.get("action");
    const therapist = url.searchParams.get("therapist");
    const client = url.searchParams.get("client");
    const slot = url.searchParams.get("slot");

    console.log("Therapist response:", { action, therapist, client, slot });

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    const supabase = getSupabase();

    // ----------------------------------
    // 1️⃣ TERMIN BESTÄTIGEN
    // ----------------------------------
    if (action === "confirm") {
      if (!therapist || !client || !slot) {
        return NextResponse.json(
          { error: "Missing parameters" },
          { status: 400 }
        );
      }

      if (!supabase) {
        return NextResponse.json(
          { error: "SUPABASE_NOT_CONFIGURED" },
          { status: 500 }
        );
      }

      // ❗ In confirmed_appointments schreiben
      const { error } = await supabase.from("confirmed_appointments").insert({
        therapist,
        client_email: client,
        slot,
      });

      if (error) {
        console.error("❌ DB INSERT ERROR:", error);
        return NextResponse.json(
          { error: "DB_INSERT_FAILED" },
          { status: 500 }
        );
      }

      // ----------------------------------
      // 3️⃣ EMAIL AN KLIENT
      // ----------------------------------
      await sendEmail(
        client,
        "Dein Termin bei Poise wurde bestätigt 🤍",
        `Hallo,

dein Erstgespräch bei ${therapist} wurde soeben bestätigt.

Termin:
${slot}

Wir freuen uns auf dich!
Dein Poise Team`
      );

      // ----------------------------------
      // 4️⃣ EMAIL AN DICH (ADMIN)
      // ----------------------------------

      const ADMIN_EMAIL = "sebastian@mypoise.de"; // ← Ändern falls nötig

      await sendEmail(
        ADMIN_EMAIL,
        "Neue Terminbestätigung",
        `Neuer bestätigter Termin:

Therapeut: ${therapist}
Klient: ${client}
Slot: ${slot}`
      );

      // ----------------------------------
      // Weiterleitung zurück zu mypoise.de
      // ----------------------------------
      return NextResponse.redirect(
        `https://mypoise.de/?resume=confirmed&email=${encodeURIComponent(
          client
        )}&therapist=${encodeURIComponent(therapist)}`
      );
    }

    // ----------------------------------
    // 2️⃣ NEUER TERMIN / gleicher Therapeut
    // ----------------------------------
    if (action === "rebook_same") {
      return NextResponse.redirect(
        `https://mypoise.de/?resume=10&email=${encodeURIComponent(
          client
        )}&therapist=${encodeURIComponent(therapist)}`
      );
    }

    // ----------------------------------
    // 3️⃣ anderes Teammitglied wählen
    // ----------------------------------
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
