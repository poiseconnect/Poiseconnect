import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);

export async function POST(request) {
  try {
    const data = await request.json();

    // 1) SUPABASE SPEICHERN
    const { error } = await supabase.from("anfragen").insert([data]);
    if (error) throw error;

    // 2) EMAIL SENDEN
    await resend.emails.send({
      from: "Poise Connect <no-reply@mypoise.de>",
      to: data.email,
      subject: "Deine Anfrage bei Poise Connect",
      html: `
        <h2>Hallo ${data.vorname},</h2>
        <p>Vielen Dank für deine Anfrage. Wir melden uns bald bei dir.</p>
      `,
    });

    // ✅ CORRECT RESPONSE
    return Response.json({ ok: true });

  } catch (err) {
    console.error("API ERROR:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
