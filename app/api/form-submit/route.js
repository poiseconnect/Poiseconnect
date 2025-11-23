export const dynamic = "force-dynamic";

import { Resend } from "resend";
// Pfad anpassen, falls deine Datei anders liegt:
import { teamData } from "../../../data/team";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

// passende E-Mail-Adresse aus teamData holen
function getTherapistEmail(name) {
  if (!name) return null;
  const t = teamData.find((p) => p.name === name);
  return t?.email || null;
}

export async function POST(request) {
  try {
    const data = await request.json();

    const {
      anliegen,
      verlauf,
      ziel,
      vorname,
      nachname,
      email,
      telefon,
      adresse,
      geburtsdatum,
      beschaeftigungsgrad,
      wunschtherapeut,
      terminDisplay,
    } = data;

    const therapistEmail = getTherapistEmail(wunschtherapeut);

    // Empfänger-Liste: Poise + gewählte Begleitung (falls gefunden)
    const recipients = ["hallo@mypoise.de"];
    if (therapistEmail && !recipients.includes(therapistEmail)) {
      recipients.push(therapistEmail);
    }

    const subject = `Neue Anfrage — ${[vorname, nachname].filter(Boolean).join(" ")}`;

    const text = `
Neue Anfrage über mypoise.de

Name: ${[vorname, nachname].filter(Boolean).join(" ")}
E-Mail: ${email || ""}
Telefon: ${telefon || ""}
Adresse: ${adresse || ""}
Geburtsdatum: ${geburtsdatum || ""}
Beschäftigung: ${beschaeftigungsgrad || ""}

Wunsch-Begleitung: ${wunschtherapeut || ""}

Anliegen:
${anliegen || ""}

Verlauf:
${verlauf || ""}

Ziel:
${ziel || ""}

Gewählter Termin:
${terminDisplay || ""}
    `.trim();

        // ✅ Mail an Team + Therapeut
    const { error } = await resend.emails.send({
      from: "hallo@mypoise.de",
      to: recipients,
      subject,
      text,
    });

        if (error) {
      console.error("Resend error:", error);
      return new Response("EMAIL_ERROR", { status: 500 });
    }

    // ✅ Bestätigungsmail an Klient
    if (email) {
      await resend.emails.send({
        from: "hallo@mypoise.de",
        to: email,
        subject: "Danke für deine Anfrage 🤍",
        text: `
Hallo ${vorname},

vielen Dank für deine Anfrage bei Poise.

Wir haben deine Daten erhalten und melden uns so schnell wie möglich bei dir.

Gewählter Termin:
${terminDisplay || "wird noch abgestimmt"}

Liebe Grüße  
Poise Team
        `.trim(),
      });
    }

    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return new Response("SERVER_ERROR", { status: 500 });
  }
}
