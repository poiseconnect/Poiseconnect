import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Zum Test: Browser zeigt sofort ob die Route lebt
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/submit" });
}

export async function POST(req) {
  try {
    const data = await req.json(); // WICHTIG

    // In Supabase speichern
    const { error } = await supabase.from("anfragen").insert([data]);
    if (error) {
      console.log("Supabase error:", error);
      return NextResponse.json({ error: "DB Fehler" }, { status: 500 });
    }

    // Bestätigungsmail an Klient
    await resend.emails.send({
      from: "Poise Connect <no-reply@mypoise.de>",
      to: data.email,
      subject: "Danke für deine Anfrage bei Poise Connect",
      html: `
        <h2>Hallo ${data.vorname},</h2>
        <p>Danke für deine Anfrage – wir melden uns bei dir.</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}
