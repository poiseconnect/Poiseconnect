import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Ausschlusskriterien → führen zu automatischer Absage
const exclusionKeywords = [
  "suizid", "selbstmord", "keinen sinn", "leben beenden",
  "selbstverletzung", "ritzen", "svv",
  "magersucht", "anorexie",
  "bulimie", "erbrechen", "kotzen",
  "binge eating",
  "borderline"
];

// Dein Absage-Text (1:1 übernommen, keine Veränderung)
const rejectionMessage = `
Vielen Dank für deine Anfrage! Erst einmal freut es uns, dass du dir vorstellen könntest mit uns zu arbeiten :) Das ist ein schönes Kompliment. Danke für dein Vertrauen und deine Offenheit. 

Leider begleiten wir dein Thema nicht im Online-Setting. Uns ist es wichtig, dass unsere Psychologinnen und Therapeutinnen nah genug dran sind, um optimal intervenieren zu können, damit du effizient und nachhaltig zu einem gesunden Umgang mit deiner Thematik findest und Linderung spürst. Daher sind wir gezwungen, nur eine Auswahl an psychologischen Themenfeldern im reinen Online-Setting umzusetzen.

Falls du in Deutschland wohnst, können wir dir folgende Adressen empfehlen, um einen Psychotherapie vor Ort zu beantragen, die von der Krankenkasse finanziert wird:

Wende dich an die 116117. Über die kassenärztliche Vereinigung kannst du eine psychotherapeutische Praxis in deiner Nähe finden, die dir innerhalb von 4 Wochen ein Erstgespräch geben sollte. Voraussetzung dafür ist, dass du bei deinem Hausarzt einen Dringlichkeitscode beantragt hast. Du kannst die 116117 telefonisch oder über die Website https://www.116117.de erreichen.

Schau nach Ausbildungsinstituten für Psychotherapie. Auch hier solltest du mit weniger Wartezeit einen Therapieplatz bekommen.

Auch Tageskliniken können eine gute Option sein.

Für die Schweiz können wir die Internetseite https://www.therapievermittlung.ch/ empfehlen. Hier kannst du gezielt nach Psychotherapeuten*innen in deiner Nähe und nach Fachrichtung suchen.

Für Österreich empfiehlt sich ein Blick auf https://www.psychotherapie.at/

Tageskliniken sind auch in der Schweiz und in Österreich eine gute Alternative, falls es mit der Psychotherapie in deiner Nähe nicht klappen sollte.

Wir hoffen, dass wir dir Ideen für das weitere Vorgehen geben konnten und du dich traust den Weg zu deiner mentalen Gesundheit weiter zu gehen. Wir wünschen dir von Herzen alles Gute!
`;

export async function POST(req) {
  try {
    const data = await req.json();
    const text = `${data.anliegen} ${data.verlauf} ${data.ziel}`.toLowerCase();

    // Check auf Ausschluss
    const isExcluded = exclusionKeywords.some((keyword) => text.includes(keyword));

    if (isExcluded) {
      // Absage an Klient*in
      await resend.emails.send({
        from: "Poise Connect <noreply@yourdomain.com>",
        to: data.email,
        subject: "Danke für deine Anfrage ♥",
        text: rejectionMessage.trim()
      });

      // Info-Mail an euch
      await resend.emails.send({
        from: "Poise Connect <system@yourdomain.com>",
        to: "hallo@mypoise.de",
        subject: "Ausschluss-Anfrage eingegangen",
        text: `
Ein Anliegen erfüllt ein Ausschlusskriterium.

Name: ${data.vorname} ${data.nachname}
E-Mail: ${data.email}
Anliegen: ${data.anliegen}
Diagnose: ${data.diagnose}
`
      });

      return NextResponse.json({ status: "rejected" });
    }

    // Normalfall → interne Anfrage-Mail
    await resend.emails.send({
      from: "Poise Connect <system@yourdomain.com>",
      to: "hallo@mypoise.de",
      subject: "Neue Anfrage über Poise Connect",
      text: `
Neue Anfrage:

Name: ${data.vorname} ${data.nachname}
E-Mail: ${data.email}
Anliegen: ${data.anliegen}
Wunschtherapeut: ${data.wunschtherapeut}
      `
    });

    return NextResponse.json({ status: "ok" });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}
