import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const data = await request.json(); // ✅ richtig in Route Handler

    // 1) Speichern in Supabase
    const { error } = await supabase.from("anfragen").insert([data]);
    if (error) throw error;

    // 2) Bestätigung an Nutzer senden
    await resend.emails.send({
      from: "Poise Connect <no-reply@mypoise.de>",
      to: data.email,
      subject: "Deine Anfrage bei Poise Connect",
      html: `
        <h2>Hallo ${data.vorname},</h2>
        <p>Vielen Dank für deine Anfrage. Wir melden uns bald bei dir.</p>
      `,
    });

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (err) {
    console.error("API ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
