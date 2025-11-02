import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/submit" });
}

export async function POST(req) {
  try {
    const data = await req.json();

    const { error } = await supabase.from("anfragen").insert([data]);
    if (error) {
      console.error("Supabase Insert Error:", error);
      return NextResponse.json({ error: "DB-Fehler" }, { status: 500 });
    }

    await resend.emails.send({
      from: "Poise Connect <no-reply@mypoise.de>",
      to: data.email,
      subject: "Danke für deine Anfrage bei Poise Connect",
      html: `<h2>Hallo ${data.vorname},</h2>
             <p>Danke für deine Anfrage — wir melden uns bald bei dir.</p>`
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Server ERROR:", err);
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}
