export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// --------------------------------------------------
// 🟣 Supabase Client (Service Role, server only)
// --------------------------------------------------
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("❌ SUPABASE ENV fehlt:", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }
  return createClient(url, key);
}

// --------------------------------------------------
// 🟣 Sende Email (Supabase SMTP)
// --------------------------------------------------
async function sendEmail(to, subject, text) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Poise <noreply@mypoise.de>",
        to,
        subject,
        text,
      }),
    });

    return res.ok;
  } catch (err) {
    console.error("EMAIL SEND ERROR");
    return false;
  }
}

// --------------------------------------------------
// 🟣 API ROUTE
// --------------------------------------------------
export async function GET(req) {
  try {
    const url = new URL(req.url);

    const action = url.searchParams.get("action");          // confirm | reject | rebook_same | rebook_other
    const clientEmail = url.searchParams.get("client");     // Klient
    const therapist = url.searchParams.get("therapist");    // Name Therapeut
    const therapistEmail = url.searchParams.get("tEmail");  // E-Mail Therapeut
    const slot = url.searchParams.get("slot");              // ISO-String

    console.log("THERAPIST RESPONSE RECEIVED:", { action, hasSlot: !!slot });

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "SUPABASE_NOT_CONFIGURED" },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 1️⃣ CONFIRM (Termin bestätigen)
    // --------------------------------------------------
    if (action === "confirm") {
      if (!therapist || !slot) {
        return NextResponse.json(
          { error: "MISSING_DATA" },
          { status: 400 }
        );
      }

      // Slot blockieren
      const { error } = await supabase
        .from("confirmed_appointments")
        .insert({
          therapist,
          therapist_email: therapistEmail || "",
          termin_iso: slot,
        });

      if (error) {
        console.error("DB ERROR:", { code: error?.code || null });
        return NextResponse.json(
          { error: "DB_INSERT_FAILED" },
          { status: 500 }
        );
      }

      // Email an Klient
      if (clientEmail) {
        await sendEmail(
          clientEmail,
          "Dein Termin wurde bestätigt 🤍",
          `Hallo,

dein Erstgespräch bei ${therapist} wurde bestätigt.

Termin:
${slot}

Wir freuen uns auf dich 🤍
Poise Team`
        );
      }

      // Email an Therapeut
      if (therapistEmail) {
        await sendEmail(
          therapistEmail,
          "Neues bestätigtes Erstgespräch",
          `Ein neuer Termin wurde bestätigt。

Therapeut: ${therapist}
Termin: ${slot}
Klient: ${clientEmail}`
        );
      }

      // Redirect zurück zu deiner App
      return NextResponse.redirect(
        `https://mypoise.de/?resume=confirmed&email=${encodeURIComponent(
          clientEmail || ""
        )}&therapist=${encodeURIComponent(therapist)}`
      );
    }

    // --------------------------------------------------
    // 2️⃣ REJECT (Termin absagen)
    // --------------------------------------------------
    if (action === "reject") {
      if (clientEmail) {
        await sendEmail(
          clientEmail,
          "Termin leider nicht möglich",
          `Hallo,

${therapist} kann diesen Termin leider nicht wahrnehmen.

Bitte wähle einen neuen Termin auf folgender Seite:
https://mypoise.de/?resume=10&email=${clientEmail}&therapist=${therapist}

Alles Liebe 🤍
Poise`
        );
      }

      return NextResponse.redirect(
        `https://mypoise.de/?resume=10&email=${clientEmail}&therapist=${therapist}`
      );
    }

    // --------------------------------------------------
    // 3️⃣ REBOOK SAME THERAPIST
    // --------------------------------------------------
    if (action === "rebook_same") {
      return NextResponse.redirect(
        `https://mypoise.de/?resume=10&email=${clientEmail}&therapist=${therapist}`
      );
    }

    // --------------------------------------------------
    // 4️⃣ REBOOK OTHER THERAPIST
    // --------------------------------------------------
    if (action === "rebook_other") {
      return NextResponse.redirect(
        `https://mypoise.de/?resume=5&email=${clientEmail}`
      );
    }

    return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (err) {
    console.error("THERAPIST RESPONSE SERVER ERROR");
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
