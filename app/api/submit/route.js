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
    const { firstname, lastname, email, message, therapist } = await request.json();

    // ✅ E-Mail senden
    await resend.emails.send({
      from: "Poise Connect <support@poiseconnect.app>",
      to: "kontakt@soulspace.life",
      subject: "Neue Anfrage",
      html: `
        <p><b>Name:</b> ${firstname} ${lastname}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Anliegen:</b><br>${message}</p>
        <p><b>Wunschtherapeut:</b> ${therapist}</p>
      `,
    });

    // ✅ In Supabase speichern (optional)
    await supabase.from("requests").insert([
      { firstname, lastname, email, message, therapist }
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
