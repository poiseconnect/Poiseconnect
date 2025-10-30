import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const data = await request.json();

    // 1️⃣ In Supabase speichern
    const { error } = await supabase.from("anfragen").insert([data]);
    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json({ error: "Fehler beim Speichern." }, { status: 500 });
    }

    // 2️⃣ E-Mail-Benachrichtigung via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Poise Connect <no-reply@mypoise.de>",
          to: [process.env.ADMIN_EMAIL, data.email],
          subject: "Neue Anfrage über Poise Connect",
          html: `
            <h3>Neue Anfrage eingegangen</h3>
            <p><b>Von:</b> ${data.vorname} ${data.nachname}</p>
            <p><b>E-Mail:</b> ${data.email}</p>
            <p><b>Anliegen:</b> ${data.anliegen}</p>
            <p><b>Leidensdruck:</b> ${data.leidensdruck}</p>
            <p><b>Wunschtherapeut:</b> ${data.wunschtherapeut}</p>
            <p><b>Ziel:</b> ${data.ziel}</p>
            <p><b>Verlauf:</b> ${data.verlauf}</p>
            <p><b>Bevorzugte Zeit:</b> ${data.bevorzugte_zeit}</p>
            <br/>
            <p>Diese E-Mail wurde automatisch von Poise Connect erstellt.</p>
          `
        })
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}
