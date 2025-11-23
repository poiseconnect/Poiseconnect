export const dynamic = "force-dynamic";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const clientEmail = url.searchParams.get("client");
    const clientName = url.searchParams.get("name") ?? "Klient";

    if (!action || !clientEmail) {
      return new Response("Ungültiger Link", { status: 400 });
    }

    // ✅ 1) Termin bestätigt
    if (action === "confirm") {
      await resend.emails.send({
        from: "hallo@mypoise.de",
        to: clientEmail,
        subject: "Termin bestätigt ✅",
        text: `Hallo ${clientName},

dein Termin wurde bestätigt ✅

Wir freuen uns auf dich!
❤️ Dein Poise Team
`,
      });

      return html("Termin bestätigt ✅");
    }

    // ✅ 2) Neuer Termin beim gleichen Teammitglied
    if (action === "rebook_same") {
      await resend.emails.send({
        from: "hallo@mypoise.de",
        to: clientEmail,
        subject: "Neuer Termin nötig 🔁",
        text: `Hallo ${clientName},

der ausgewählte Termin kann leider nicht stattfinden.

Bitte wähle einen neuen Termin:

https://mypoise.de?retry=same&client=${encodeURIComponent(clientEmail)}

Liebe Grüße
Dein Poise Team
`,
      });

      return html("Klient kann neuen Termin wählen 🔁");
    }

    // ✅ 3) Anderes Teammitglied auswählen
    if (action === "rebook_other") {
      await resend.emails.send({
        from: "hallo@mypoise.de",
        to: clientEmail,
        subject: "Neue Begleitung auswählen 💡",
        text: `Hallo ${clientName},

die gewählte Begleitung ist aktuell nicht verfügbar.

Bitte wähle eine andere Begleitung:

https://mypoise.de?retry=other&client=${encodeURIComponent(clientEmail)}

Liebe Grüße
Dein Poise Team
`,
      });

      return html("Klient soll anderes Teammitglied wählen 💡");
    }

    return new Response("Unbekannte Aktion", { status: 400 });

  } catch (err) {
    console.error("THERAPIST RESPONSE ERROR:", err);
    return new Response("SERVER ERROR", { status: 500 });
  }
}

function html(msg) {
  return new Response(
    `<html><body style="font-family:sans-serif;text-align:center;padding:40px;">
      <h2>${msg}</h2>
      <p>Danke für deine Rückmeldung!</p>
    </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
