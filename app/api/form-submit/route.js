export const dynamic = "force-dynamic";

import { Resend } from "resend";
import { teamData } from "../../data/team.js";

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

    // ✅ Links für Auswahl durch Teammitglied
    const base = "https://poiseconnect.vercel.app/api/therapist-response/";

    const confirmLink = `${base}?action=confirm&client=${encodeURIComponent(email)}&name=${encodeURIComponent(vorname?.trim() || "")}`;
const rebookSameLink = `${base}?action=rebook_same&client=${encodeURIComponent(email)}&name=${encodeURIComponent(vorname?.trim() || "")}`;
const rebookOtherLink = `${base}?action=rebook_other&client=${encodeURIComponent(email)}&name=${encodeURIComponent(vorname?.trim() || "")}`;

    // ✅ Empfänger: Poise + gewählte Begleitung
    const recipients = ["hallo@mypoise.de"];
    if (therapistEmail && !recipients.includes(therapistEmail)) {
      recipients.push(therapistEmail);
    }

    const subject = `Neue Anfrage — ${vorname} ${nachname}`;

    // ✅ Mail an Teammitglied + Poise
    const { error } = await resend.emails.send({
      from: "hallo@mypoise.de",
      to: recipients,
      subject,
      text: `
Neue Anfrage über mypoise.de

Name: ${vorname} ${nachname}
E-Mail: ${email}
Telefon: ${telefon || ""}
Adresse: ${adresse || ""}
Geburtsdatum: ${geburtsdatum || ""}
Beschäftigung: ${beschaeftigungsgrad || ""}

Wunsch-Begleitung: ${wunschtherapeut || ""}

---

👉 Bitte wähle aus:

✅ Termin bestätigen
${confirmLink}

🔁 Neuer Termin mit mir wählen
${rebookSameLink}

🔄 An anderes Teammitglied übergeben
${rebookOtherLink}

---

Anliegen:
${anliegen || ""}

Verlauf:
${verlauf || ""}

Ziel:
${ziel || ""}

Gewählter Termin:
${terminDisplay || ""}
      `.trim(),
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
