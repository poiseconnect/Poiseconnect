export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ----------------------------------------------------
// SUPABASE SERVICE ROLE KEY CLIENT
// ----------------------------------------------------
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

// ----------------------------------------------------
// POST /api/therapist-response
// ----------------------------------------------------
export async function POST(req) {
  try {
    const body = await req.json();

    const {
      action,          // "confirm" | "reject" | "new_same" | "new_other"
      email,           // Klient
      therapist,       // Name Teammitglied
      terminISO,       // optional
      terminDisplay,   // optional
      request_id       // ID aus Tabelle "anfragen"
    } = body;

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "SUPABASE_NOT_CONFIGURED" },
        { status: 500 }
      );
    }

    // ----------------------------------------------------
    // A) TERMIN BESTÄTIGEN
    // ----------------------------------------------------
    if (action === "confirm") {
      if (!terminISO || !terminDisplay) {
        return NextResponse.json(
          { error: "MISSING_TERMIN" },
          { status: 400 }
        );
      }

      // 1) Termin blockieren
      await supabase.from("confirmed_appointments").insert({
        email,
        therapist,
        termin_iso: terminISO,
        termin_display: terminDisplay,
      });

      // 2) Anfrage erledigt
      await supabase
        .from("anfragen")
        .update({ erledigt: true })
        .eq("id", request_id);

      // 3) Mail an Klient
      await sendEmail({
        to: email,
        subject: "Bestätigung deines Erstgesprächs",
        text: `Hallo,

${therapist} hat dein Erstgespräch bestätigt.

Termin:
${terminDisplay}

Liebe Grüße
Poise 🤍`,
      });

      return NextResponse.json({
        ok: true,
        redirect: `/thank-you-confirmed`
      });
    }

    // ----------------------------------------------------
    // B) TERMIN ABSAGEN
    // ----------------------------------------------------
    if (action === "reject") {
      await sendEmail({
        to: email,
        subject: "Rückmeldung zu deiner Anfrage",
        text: `Hallo,

${therapist} kann deinen vorgeschlagenen Termin leider nicht wahrnehmen.

Bitte wähle jederzeit einen neuen Termin aus.

Liebe Grüße
Poise 🤍`,
      });

      return NextResponse.json({
        ok: true,
        redirect: `/thank-you-rejected`
      });
    }

    // ----------------------------------------------------
    // C) GLEICHER THERAPEUT – neuer Termin
    // ----------------------------------------------------
    if (action === "new_same") {
      await sendEmail({
        to: email,
        subject: "Bitte wähle einen neuen Termin",
        text: `Hallo,

${therapist} bittet dich, einen neuen Termin auszuwählen.

Du kannst direkt hier weitermachen:
https://mypoise.de/?resume=10&email=${encodeURIComponent(email)}&therapist=${encodeURIComponent(therapist)}

Liebe Grüße
Poise 🤍`,
      });

      return NextResponse.json({
        ok: true,
        redirect: `https://mypoise.de/?resume=10&email=${email}&therapist=${therapist}`
      });
    }

    // ----------------------------------------------------
    // D) ANDERES TEAMMITGLIED WÄHLEN
    // ----------------------------------------------------
    if (action === "new_other") {
      await sendEmail({
        to: email,
        subject: "Bitte wähle ein anderes Teammitglied",
        text: `Hallo,

${therapist} kann deinen Termin leider nicht übernehmen.

Bitte wähle ein anderes Teammitglied:
https://mypoise.de/?resume=5&email=${encodeURIComponent(email)}

Liebe Grüße
Poise 🤍`,
      });

      return NextResponse.json({
        ok: true,
        redirect: `https://mypoise.de/?resume=5&email=${email}`
      });
    }

    // ----------------------------------------------------
    // Unbekannte Action
    // ----------------------------------------------------
    return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });

  } catch (err) {
    console.error("❌ SERVER ERROR IN THERAPIST-RESPONSE:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------
// SEPARATE EMAIL SEND FUNCTION
// ----------------------------------------------------
async function sendEmail({ to, subject, text }) {
  try {
    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resend-email`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, text }),
      }
    );
  } catch (err) {
    console.error("❌ EMAIL SEND ERROR:", err);
  }
}
