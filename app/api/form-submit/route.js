export const dynamic = "force-dynamic";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

export async function POST(request) {
  try {
    const data = await request.json();

    const { anliegen, verlauf, ziel, vorname, nachname, email, terminDisplay } = data;

    const { error } = await resend.emails.send({
      from: "hallo@mypoise.de",
      to: "hallo@mypoise.de",
      subject: `Neue Anfrage — ${vorname} ${nachname}`,
      text: `Neue Anfrage:\n${anliegen}\nTermin: ${terminDisplay}`,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response("EMAIL_ERROR", { status: 500 });
    }

    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return new Response("SERVER_ERROR", { status: 500 });
  }
}
