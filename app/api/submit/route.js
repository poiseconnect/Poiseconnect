import { Resend } from "resend";

export async function POST(req) {
  try {
    const data = await req.json(); // ✅ richtiger Body-Parser

    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "Poise Connect <noreply@poiseconnect.app>",
      to: "kontakt@poiseconnect.app",
      subject: "Neue Anfrage über Poise Connect",
      html: `
        <h2>Neue Anfrage</h2>
        <p><strong>Anliegen:</strong> ${data.anliegen}</p>
        <p><strong>Leidensdruck:</strong> ${data.leidensdruck}</p>
        <p><strong>Verlauf:</strong> ${data.verlauf}</p>
        <p><strong>Ziel:</strong> ${data.ziel}</p>
        <p><strong>Wunschtherapeutin:</strong> ${data.wunschtherapeut}</p>
        <hr />
        <p><strong>Name:</strong> ${data.vorname} ${data.nachname}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Adresse:</strong> ${data.ort}, ${data.strasse}</p>
        <p><strong>Geburtsdatum:</strong> ${data.geburtsdatum}</p>
        <p><strong>Beschäftigungsgrad:</strong> ${data.beschaeftigung}</p>
      `,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
