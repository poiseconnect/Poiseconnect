// app/api/form-submit/route.js
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
      terminISO, // wichtig!
    } = data;

    const therapistEmail = getTherapistEmail(wunschtherapeut);

    // Empfänger-Liste: Poise + gewählte Begleitung (falls gefunden)
    const recipients = ["hallo@mypoise.de"];
    if (therapistEmail && !recipients.includes(therapistEmail)) {
      recipients.push(therapistEmail);
    }

    const fullName = [vorname, nachname].filter(Boolean).join(" ");

    // Basis-URL auf deine API (Therapist-Response)
    const base = "https://poiseconnect.vercel.app/api/therapist-response";

    // Links für die Therapeut:innen
    const confirmLink =
      `${base}?action=confirm` +
      `&client=${encodeURIComponent(email || "")}` +
      `&therapist=${encodeURIComponent(wunschtherapeut || "")}` +
      `&termin=${encodeURIComponent(terminISO || "")}`;

    const rebookSameLink =
      `${base}?action=rebook_same` +
      `&client=${encodeURIComponent(email || "")}` +
      `&therapist=${encodeURIComponent(wunschtherapeut || "")}`;

    const rebookOtherLink =
      `${base}?action=rebook_other` +
      `&client=${encodeURIComponent(email || "")}`;

    const subject = `Neue Anfrage — ${fullName || "Unbekannt"}`;

    const textTeam = `
Neue Anfrage über mypoise.de

Name: ${fullName}
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

────────────────────────
Aktion für dich:

✓ Termin bestätigen:
${confirmLink}

⟳ Anderen Termin MIT dir finden:
${rebookSameLink}

⇄ Anderes Teammitglied vorschlagen:
${rebookOtherLink}
    `.trim();

    // ✅ Mail an Team + Therapeut
    const { error } = await resend.emails.send({
      from: "hallo@mypoise.de",
      to: recipients,
      subject,
      text: textTeam,
    });

    if (error) {
      console.error("Resend error (Team):", error);
      return new Response("EMAIL_ERROR", { status: 500 });
    }

    // ✅ Bestätigungsmail an Klient
    if (email) {
      const textClient = `
Hallo ${vorname || ""},

vielen Dank für deine Anfrage bei Poise.

Wir haben deine Daten erhalten und melden uns so schnell wie möglich bei dir.

Gewählter Termin:
${terminDisplay || "wird noch abgestimmt"}

Liebe Grüße  
Poise Team
      `.trim();

      await resend.emails.send({
        from: "hallo@mypoise.de",
        to: email,
        subject: "Danke für deine Anfrage 🤍",
        text: textClient,
      });
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return new Response("SERVER_ERROR", { status: 500 });
  }
}
