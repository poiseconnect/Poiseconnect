import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const data = await req.json(); // <--- WICHTIG

    const { error } = await supabase.from("anfragen").insert([data]);
    if (error) throw error;

    await resend.emails.send({
      from: "Poise Connect <no-reply@mypoise.de>",
      to: data.email,
      subject: "Deine Anfrage bei Poise Connect",
      html: `
        <h2>Hallo ${data.vorname},</h2>
        <p>Danke für deine Anfrage. Wir melden uns bald.</p>
      `,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("API ERROR:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
