import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Ausschluss-Themen (Absage)
const RED_FLAGS = [
  "suizid", "selbstmord", "selbstverletzung", "ritzen",
  "magersucht", "anorexie", "bulimie", "essstörung",
  "binge", "binge eating", "borderline", "svv"
];

const isRedFlag = (text) => {
  if (!text) return false;
  const t = String(text || "").toLowerCase();
  return RED_FLAGS.some((f) => t.includes(f));
};

// Hilfsfunktionen: Datumsformat & Kalenderlink
function pad(n) { return n < 10 ? `0${n}` : `${n}`; }
function toGCalDateString(date) {
  // YYYYMMDDTHHMMSS (ohne Z; wir übergeben &ctz=Europe/Vienna)
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("") + "T" + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("");
}

function buildGoogleCalendarLink({ title, details, location, startISO, durationMin = 30, ctz = "Europe/Vienna" }) {
  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationMin * 60000);

  const dates = `${toGCalDateString(start)}/${toGCalDateString(end)}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title || "Erstgespräch",
    details: details || "",
    location: location || "Online (Video-Call)",
    dates,
    ctz
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export async function POST(req) {
  try {
    const data = await req.json();

    const {
      anliegen, leidensdruck, verlauf, diagnose, ziel,
      wunschtherapeut, vorname, nachname, email, adresse,
      geburtsdatum, beschaeftigungsgrad,

      // Step 8
      check_datenschutz, check_online_setting, check_gesundheit,

      // Step 9
      terminISO,            // ISO-Start (aus Step 9)
      terminDisplay         // z.B. "Mo, 10.11 10:00 – 10:30"
    } = data;

    const fullText = `${anliegen || ""} ${verlauf || ""} ${ziel || ""}`;

    // 1) ABSAGE bei kritischen Themen
    if (isRedFlag(fullText)) {
      await resend.emails.send({
        from: "Poise Begleitung <hallo@mypoise.de>",
        to: email,
        subject: "Danke für deine Anfrage 💛",
        text: `Vielen Dank für deine Anfrage! Erst einmal freut es uns, dass du dir vorstellen könntest mit uns zu arbeiten :) Das ist ein schönes Kompliment. Danke für dein Vertrauen und deine Offenheit. 

Leider begleiten wir dein Thema nicht im Online-Setting. Uns ist es wichtig, dass unsere Psychologinnen und Therapeutinnen nah genug dran sind, um optimal intervenieren zu können, damit du effizient und nachhaltig zu einem gesunden Umgang mit deiner Thematik findest und Linderung spürst. Daher sind wir gezwungen, nur eine Auswahl an psychologischen Themenfeldern im reinen Online-Setting umzusetzen.

Falls du in Deutschland wohnst, können wir dir folgende Adressen empfehlen, um einen Psychotherapie vor Ort zu beantragen, die von der Krankenkasse finanziert wird: 

Wende dich an die 116117. Über die kassenärztliche Vereinigung kannst du eine psychotherapeutische Praxis in deiner Nähe finden, die dir innerhalb von 4 Wochen ein Erstgespräch geben sollte. Voraussetzung dafür ist, dass du bei deinem Hausarzt einen Dringlichkeitscode beantragt hast. Du kannst die 116117 telefonisch oder über die Website https://www.116117.de erreichen. 

Schau nach Ausbildungsinstituten für Psychotherapie. Auch hier solltest du mit weniger Wartezeit einen Therapieplatz bekommen.

Auch Tageskliniken können eine gute Option sein.
Für die Schweiz können wir die Internetseite https://www.therapievermittlung.ch/ empfehlen. Hier kannst du gezielt nach Psychotherapeuten*innen in deiner Nähe und nach Fachrichtung suchen. 
Für Österreich empfiehlt sich ein Blick auf https://www.psychotherapie.at/ 
Tageskliniken sind auch in der Schweiz und in Österreich eine gute Alternative, falls es mit der Psychotherapie in deiner Nähe nicht klappen sollte. 
Wir hoffen, dass wir dir Ideen für das weitere Vorgehen geben konnten und du dich traust den Weg zu deiner mentalen Gesundheit weiter zu gehen. Wir wünschen dir von Herzen alles Gute!`
      });
      return NextResponse.json({ ok: true, type: "declined" });
    }

    // 2) Interne Mail an Poise (alle Daten inkl. Termin)
    const internSubject = `Neue Anfrage – ${vorname || ""} ${nachname || ""}`.trim();
    const internText = `
Neue Anfrage über das Formular

Anliegen:
${anliegen || "-"}

Leidensdruck: ${leidensdruck || "-"}
Verlauf: ${verlauf || "-"}
Diagnose: ${diagnose || "-"}
Ziel: ${ziel || "-"}

Ausgewählte Begleitung: ${wunschtherapeut || "-"}

--- Gewählter Termin ---
${terminDisplay || "-"}
Start ISO: ${terminISO || "-"}

--- Kontakt ---
Name: ${vorname || "-"} ${nachname || "-"}
E-Mail: ${email || "-"}
Adresse: ${adresse || "-"}
Geburtsdatum: ${geburtsdatum || "-"}
Beschäftigung: ${beschaeftigungsgrad || "-"}

--- Bestätigungen ---
Datenschutz: ${check_datenschutz ? "ja" : "nein"}
Online-Setting: ${check_online_setting ? "ja" : "nein"}
Gesundheit (keine Red Flags): ${check_gesundheit ? "ja" : "nein"}
    `.trim();

    await resend.emails.send({
      from: "Poise Connect <hallo@mypoise.de>",
      to: "hallo@mypoise.de",
      subject: internSubject,
      text: internText
    });

    // 3) Bestätigung an Klient*in (mit Add-to-Calendar-Link)
    if (email) {
      const gcalLink = terminISO
        ? buildGoogleCalendarLink({
            title: `Erstgespräch – ${wunschtherapeut || "Poise"}`,
            details:
              "Das Erstgespräch findet online im Video-Call statt. Bitte sorge für eine ruhige Umgebung. Wenn du verhindert bist, gib uns bitte kurz Bescheid.",
            location: "Online (Video-Call)",
            startISO: terminISO,
            durationMin: 30,
            ctz: "Europe/Vienna"
          })
        : "";

      const userSubject = "Bestätigung deiner Anfrage bei Poise 💛";
      const userText = `
Hallo ${vorname || ""},

vielen Dank für deine Anfrage und dein Vertrauen!

${
  terminDisplay
    ? `Dein gewählter Termin (Erstgespräch) bei ${wunschtherapeut || "unserem Team"}:
${terminDisplay}

Du kannst dir den Termin hier in deinen Google Kalender eintragen:
${gcalLink}

`
    : ""
}Wir melden uns zeitnah bei dir per E-Mail mit den nächsten Schritten.

Herzliche Grüße
Dein Poise Team
      `.trim();

      const userHtml = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;color:#222">
          <p>Hallo ${vorname || ""},</p>
          <p>vielen Dank für deine Anfrage und dein Vertrauen!</p>
          ${
            terminDisplay
              ? `<p><strong>Dein gewählter Termin (Erstgespräch)</strong> bei ${wunschtherapeut || "unserem Team"}:<br>
                 ${terminDisplay}</p>
                 <p><a href="${gcalLink}" target="_blank" style="display:inline-block;background:#A27C77;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px">In Google Kalender speichern</a></p>`
              : ``
          }
          <p>Wir melden uns zeitnah per E-Mail mit den nächsten Schritten.</p>
          <p>Herzliche Grüße<br>Dein Poise Team</p>
        </div>
      `;

      await resend.emails.send({
        from: "Poise Begleitung <hallo@mypoise.de>",
        to: email,
        subject: userSubject,
        text: userText,
        html: userHtml
      });
    }

    return NextResponse.json({ ok: true, type: "sent" });

  } catch (err) {
    console.error("Submit error:", err);
    return NextResponse.json({ error: "Serverfehler" }, { status: 500 });
  }
}
