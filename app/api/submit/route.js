import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Liste der Ausschluss-Themen
const RED_FLAGS = [
  "suizid", "selbstmord", "selbstverletzung", "ritzen",
  "magersucht", "anorexie", "bulimie", "essstörung",
  "binge", "binge eating", "borderline", "svv"
];

const isRedFlag = (text) => {
  if (!text) return false;
  const t = text.toLowerCase();
  return RED_FLAGS.some(flag => t.includes(flag));
};

export async function POST(req) {
  try {
    const data = await req.json();

    const {
      anliegen, leidensdruck, verlauf, diagnose, ziel,
      wunschtherapeut, vorname, nachname, email, adresse,
      geburtsdatum, beschaeftigungsgrad
    } = data;

    // -------------------------------
    // 1) ABSAGE — falls kritisches Thema
    // -------------------------------
    if (isRedFlag(anliegen + " " + ziel + " " + verlauf)) {
      await resend.emails.send({
        from: "Poise Begleitung <hallo@mypoise.de>",
        to: email,
        subject: "Danke für deine Anfrage 💛",
        text: `
Vielen Dank für deine Anfrage! Erst einmal freut es uns, dass du dir vorstellen könntest mit uns zu arbeiten :) Das ist ein schönes Kompliment. Danke für dein Vertrauen und deine Offenheit.

Leider begleiten wir dein Thema nicht im Online-Setting. Uns ist es wichtig, dass unsere Psychologinnen und Therapeutinnen nah genug dran sind, um optimal intervenieren zu können, damit du effizient und nachhaltig zu einem gesunden Umgang mit deiner Thematik findest und Linderung spürst. Daher sind wir gezwungen, nur eine Auswahl an psychologischen Themenfeldern im reinen Online-Setting umzusetzen.

Falls du in Deutschland wohnst:
→ Psychotherapie über die Krankenkasse: 116117 oder https://www.116117.de
→ Ausbildungsinstitute für Psychotherapie (meist mit kurzfristigeren Plätzen)
→ Tageskliniken

Schweiz:
→ https://www.therapievermittlung.ch/

Österreich:
→ https://www.psychotherapie.at/

Wir wünschen dir von Herzen alles Gute auf deinem Weg.
💛 Dein Poise Team
        `
      });

      return NextResponse.json({ ok: true, type: "declined" });
    }

    // -------------------------------
    // 2) Anfrage an Poise senden
    // -------------------------------
    await resend.emails.send({
      from: "Poise Connect <hallo@mypoise.de>",
      to: "hallo@mypoise.de",
      subject: `Neue Anfrage – ${vorname} ${nachname}`,
      text: `
Neue Anfrage über das Formular:

Anliegen:
${anliegen}

Leidensdruck: ${leidensdruck}
Verlauf: ${verlauf}
Diagnose: ${diagnose}
Ziel: ${ziel}

Ausgewählte Begleitung: ${wunschtherapeut}

--- Kontakt ---
Name: ${vorname} ${nachname}
E-Mail: ${email}
Adresse: ${adresse}
Geburtsdatum: ${geburtsdatum}
Beschäftigung: ${beschaeftigungsgrad}
      `
    });

    return NextResponse.json({ ok: true, type: "sent" });

  } catch (err) {
    console.error("Submit error:", err);
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}
