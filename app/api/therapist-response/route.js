export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

// --- Supabase Verbindung ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // ⚠️ SERVICE KEY, NICHT public key
);

// --- Resend Init ---
const resend = new Resend(process.env.RESEND_API_KEY ?? "");

// --- Helper: Mail senden ---
async function sendMail(to, subject, text) {
  try {
    const { error } = await resend.emails.send({
      from: "hallo@mypoise.de",
      to,
      subject,
      text,
    });
    if (error) console.error("EMAIL ERROR:", error);
  } catch (err) {
    console.error("MAIL SEND FAILED:", err);
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const action = searchParams.get("action");      // confirm | rebook_same | rebook_other
    const client = searchParams.get("client");      // email des Klienten
    const therapist = searchParams.get("therapist");// Name der Begleitung
    const slot = searchParams.get("slot");          // ISO Datum Zeit

    console.log("Therapist response:", action, client, therapist, slot);

    // -------------------------------
    // 1) TERMIN BESTÄTIGEN
    // -------------------------------
    if (action === "confirm") {
      if (!client || !slot || !therapist) {
        return NextResponse.json(
          { error: "Missing parameters" },
          { status: 400 }
        );
      }

      // Supabase speichern
      await supabase.from("confirmed_appointments").insert([
        {
          client_email: client,
          therapist,
          slot,
          created_at: new Date().toISOString(),
        },
      ]);

      // Klient erhält Bestätigungsmail
      await sendMail(
        client,
        "Termin bestätigt 🤍",
        `
Hallo,

dein Termin bei ${therapist} wurde bestätigt.

Datum & Zeit:
${slot}

Wir freuen uns auf dich!

Liebe Grüße  
Poise Team
        `.trim()
      );

      // Weiterleitung an Poise Landing
      return NextResponse.redirect("https://mypoise.de/?confirmed=1");
    }

    // -------------------------------
    // 2) NEUER TERMIN (GLEICHE BEGLEITUNG)
    // -------------------------------
    if (action === "rebook_same") {
      if (!client || !therapist) {
        return NextResponse.json(
          { error: "Missing client or therapist" },
          { status: 400 }
        );
      }

      // Klient erhält Mail
      await sendMail(
        client,
        "Bitte wähle einen neuen Termin 🤍",
        `
Hallo,

${therapist} hat dich gebeten, einen neuen Termin auszuwählen.

Bitte wähle deinen neuen Termin hier:

https://poiseconnect.vercel.app/?resume=10&email=${encodeURIComponent(
          client
        )}&therapist=${encodeURIComponent(therapist)}

Liebe Grüße  
Poise Team
        `.trim()
      );

      // Weiterleitung (Therapeut)
      return NextResponse.redirect(
        `https://mypoise.de/?rebook_same=1`
      );
    }

    // -------------------------------
    // 3) ANDERES TEAMMITGLIED
    // -------------------------------
    if (action === "rebook_other") {
      if (!client) {
        return NextResponse.json(
          { error: "Missing client" },
          { status: 400 }
        );
      }

      // Klient erhält Mail
      await sendMail(
        client,
        "Bitte wähle eine neue Begleitung 🤍",
        `
Hallo,

dein ausgewähltes Teammitglied hat dir empfohlen,
eine andere Begleitung auszuwählen.

Bitte wähle eine neue Person hier:

https://poiseconnect.vercel.app/?resume=5&email=${encodeURIComponent(
          client
        )}

Liebe Grüße  
Poise Team
        `.trim()
      );

      return NextResponse.redirect("https://mypoise.de/?rebook_other=1");
    }

    // -------------------------------
    // UNBEKANNTE AKTION
    // -------------------------------
    return NextResponse.json(
      { error: "UNKNOWN_ACTION" },
      { status: 400 }
    );
  } catch (err) {
    console.error("THERAPIST RESPONSE ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: err.toString() },
      { status: 500 }
    );
  }
}
