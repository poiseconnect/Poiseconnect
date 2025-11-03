import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  try {
    // ✅ Request Body korrekt lesen
    const data = await request.json();

    // ✅ Supabase Client erstellen
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ✅ In Datenbank speichern
    const { error } = await supabase.from("anfragen").insert([data]);
    if (error) {
      console.error("Supabase Insert Error:", error);
      return NextResponse.json({ error: "DB Error" }, { status: 500 });
    }

    // ✅ Resend Email senden
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "Poise Connect <no-reply@mypoise.de>",
      to: data.email,
      subject: "Deine Anfrage bei Poise Connect",
      html: `
        <h2>Hallo ${data.vorname},</h2>
        <p>Danke für deine Anfrage. Wir melden uns zeitnah bei dir.</p>
      `,
    });

    // ✅ Erfolgreiche Antwort
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
