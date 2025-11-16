import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const RED_FLAGS = [
  "suizid", "selbstmord", "selbstverletzung", "ritzen",
  "magersucht", "anorexie", "bulimie", "bulimia", "erbrechen",
  "binge", "binge eating", "essstörung", "essstoerung",
  "borderline", "svv"
];

function isRedFlag(text) {
  if (!text) return false;
  const t = String(text).toLowerCase();
  return RED_FLAGS.some(flag => t.includes(flag));
}

export async function POST(request) {
  try {
    const data = await request.json();

    const {
      anliegen,
      verlauf,
      ziel,
      wunschtherapeut,
      vorname,
      nachname,
      email,
      adresse,
      geburtsdatum,
      beschaeftigungsgrad,
      terminDisplay,
    } = data;

    const isCritical =
      isRedFlag(anliegen) ||
      isRedFlag(verlauf) ||
      isRedFlag(ziel);

    const subject = isCritical
      ? `⚠️ Kritischer Fall — Bitte Rückmeldung`
      : `Neue Anfrage — ${vorname} ${nachname}`;

    const text = `
Name: ${vorname} ${nachname}
E-Mail: ${email}
Adresse: ${adresse}
Geburtsdatum: ${geburtsdatum}
Beschäftigung: ${beschaeftigungsgrad}

Anliegen:
${anliegen}

Verlauf:
${verlauf}

Ziel:
${ziel}

Wunsch-Begleitung:
${wunschtherapeut}

${!isCritical
        ? `Gewählter Termin: ${terminDisplay}`
        : `⚠️ Red-Flag erkannt → Bitte intern abklären.`}
`.trim();


    // 🧨 WICHTIG: Fehler hier sauber abfangen
    const response = await resend.emails.send({
      from: "hallo@mypoise.de",
      to: "hallo@mypoise.de",
      subject,
      text,
    });

    if (response.error) {
      console.error("Resend Fehler:", response.error);

      return NextResponse.json(
        { error: response.error.message || "Mailversand fehlgeschlagen." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (err) {
    console.error("Server Fehler:", err);

    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
