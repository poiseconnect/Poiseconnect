import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const RED_FLAGS = [
  "suizid", "selbstmord", "selbstverletzung", "ritzen",
  "magersucht", "anorexie", "bulimie", "bulimia", "erbrechen",
  "binge", "essstörung", "essstoerung",
  "zwang", "halluzination", "wahn", "psychose", "schizophren",
  "borderline", "ptbs", "trauma", "bipolar"
];

function isRedFlag(text) {
  if (!text) return false;
  const t = text.toString().toLowerCase();
  return RED_FLAGS.some((flag) => t.includes(flag));
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

${isCritical
        ? `⚠️ Red-Flag erkannt → Bitte intern prüfen.`
        : `Gewählter Termin: ${terminDisplay}`
      }
    `.trim();


    // 🟢 E-Mail senden
    const result = await resend.emails.send({
      from: "hallo@mypoise.de",
      to: "hallo@mypoise.de",
      subject,
      text,
    });

    console.log("Resend result:", result);

    if (result.error) {
      console.error("Resend Error:", result.error);
      return NextResponse.json(
        { error: "Resend Fehler", details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  catch (err) {
    console.error("Server Fehler:", err);
    return NextResponse.json(
      { error: "Serverfehler", details: err.toString() },
      { status: 500 }
    );
  }
}
