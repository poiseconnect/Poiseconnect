import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 🔐 Supabase Server Client (Service Role Key → nur auf Server)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request) {
  try {
    const data = await request.json();

    // 1️⃣ Anfrage in Supabase speichern
    const { error } = await supabase.from("anfragen").insert([data]);

    if (error) {
      console.error("Supabase Insert Error:", error);
      return NextResponse.json(
        { error: "Fehler beim Speichern in der Datenbank." },
        { status: 500 }
      );
    }

    // 2️⃣ E-Mail Benachrichtigung (Resend)
    if (process.env.RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Poise Connect <no-reply@mypoise.de>",
          to: [
            process.env.ADMIN_EMAIL, // Du / Verwaltung
            data.email, // Klient
          ],
          subject: "Neue Anfrage über Poise Connect",
          html: `
            <h2>Neue Anfrage</h2>
            <p><b>Name:</b> ${data.vorname} ${data.nachname}</p>
            <p><b>E-Mail:</b> ${data.email}</p>
            <p><b>Anliegen:</b> ${data.anliegen}</p>
            <p><b>Leidensdruck:</b> ${data.leidensdruck}</p>
            <p><b>Wunschtherapeut:</b> ${data.wunschtherapeut}</p>
            <p><b>Ziel:</b> ${data.ziel}</p>
            <p><b>Verlauf:</b> ${data.verlauf}</p>
            <p><b>Bevorzugte Zeit:</b> ${data.bevorzugte_zeit}</p>
            <br/>
            <p>Diese E-Mail wurde automatisch über Poise Connect versendet.</p>
          `,
        }),
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Server Error:", err);
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}
