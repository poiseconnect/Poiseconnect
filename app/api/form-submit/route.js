export const dynamic = "force-dynamic";

import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { teamData } from "../../../data/team.js";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

// Supabase Client (Server)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// passende Email-Adresse aus teamData
function getTherapistEmail(name) {
  const t = teamData.find((p) => p.name === name);
  return t?.email || "hallo@mypoise.de";
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
      terminISO,
      terminDisplay,
    } = data;

    const therapistEmail = getTherapistEmail(wunschtherapeut);

    // ----------------------------------------------------
    // 1) Anfrage in Supabase speichern
    // ----------------------------------------------------
    await supabase.from("anfragen").insert({
      vorname,
      nachname,
      email,
      strasse_hausnr: adresse,
      geburtsdatum,
      beschaeftigungsgrad,
      anliegen,
      verlauf,
      ziel,
      wunschtherapeut,
    });

    // ----------------------------------------------------
    // 2) Email an Team vorbereiten
    // ----------------------------------------------------

    const base = "https://poiseconnect.vercel.app/api/therapist-response";

    const confirmLink = `${base}?action=confirm&client=${encodeURIComponent(
      email
    )}&therapist=${encodeURIComponent(
      wunschtherapeut
    )}&termin=${encodeURIComponent(terminISO)}`;

    const rebookSame = `${base}?action=rebook_same&client=${encodeURIComponent(
      email
    )}&therapist=${encodeURIComponent(wunschtherapeut)}`;

    const rebookOther = `${base}?action=rebook_other&client=${encodeURIComponent(
      email
    )}`;

    const recipients = ["hallo@mypoise.de"];
    if (therapistEmail && !recipients.includes(therapistEmail)) {
      recipients.push(therapistEmail);
    }

    const teamMail = `
Neue Anfrage über mypoise.de

Name: ${vorname} ${nachname}
E-Mail: ${email}
Telefon: ${telefon}
Adresse: ${adresse}
Geburtsdatum: ${geburtsdatum}
Beschäftigung: ${beschaeftigungsgrad}

Wunsch-Begleitung: ${wunschtherapeut}

Anliegen:
${anliegen}

Verlauf:
${verlauf}

Ziel:
${ziel}

📅 Gewählter Termin:
${terminDisplay}

---

🔗 Aktionen für das Team:

1) Termin bestätigen  
${confirmLink}

2) Neuer Termin (selbe Begleitung)  
${rebookSame}

3) Anderes Teammitglied wählen  
${rebookOther}

    `.trim();

    // ----------------------------------------------------
    // 3) Mail an Team senden
    // ----------------------------------------------------
    const { error: teamError } = await resend.emails.send({
      from: "hallo@mypoise.de",
      to: recipients,
      subject: `Neue Anfrage — ${vorname} ${nachname}`,
      text: teamMail,
    });

    if (teamError) {
      console.error("Resend error:", teamError);
      return new Response("EMAIL_ERROR", { status: 500 });
    }

    // ----------------------------------------------------
    // 4) Bestätigungsmail an Klient
    // ----------------------------------------------------
    await resend.emails.send({
      from: "hallo@mypoise.de",
      to: email,
      subject: "Danke für deine Anfrage 🤍",
      text: `
Hallo ${vorname},

vielen Dank für deine Anfrage bei Poise.

Wir haben deine Daten erhalten und melden uns so schnell wie möglich bei dir.

Gewählter Termin:
${terminDisplay}

Liebe Grüße  
Poise Team
      `.trim(),
    });

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return new Response("SERVER_ERROR", { status: 500 });
  }
}
