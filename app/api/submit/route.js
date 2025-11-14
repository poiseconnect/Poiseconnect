import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ---- RED-FLAGS ----
const RED_FLAGS = [
  "suizid", "selbstmord", "selbstverletzung", "ritzen",
  "magersucht", "anorexie", "bulim", "bulimia", "erbrechen",
  "binge", "binge eating", "essstörung", "essstoerung",
  "borderline", "svv"
];

function isRedFlag(text) {
  if (!text) return false;
  const t = String(text).toLowerCase();
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

    // ---- Check Red-Flags ----
    const isCritical =
      isRedFlag(anliegen) ||
      isRedFlag(verlauf) ||
      isRedFlag(ziel);

    // ---- E-Mail Betreff ----
    const subject = isCritical
      ? `⚠️ Kritischer Fall — Bitte Rückmeldung`
      : `Neue Anfrage — ${vorname} ${nachname}`;

    // ---- E-Mail Inhalt ----
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
  : `⚠️ Red-Flag erkannt → Bitte intern abklären.`
}
`.trim();

    // ---- RESEND API CALL ----
    const result = await resend.emails.send({
      from: "Poise <hallo@mypoise.de>",
      to: ["hallo@mypoise.de"],
      subject,
      text,
    });

    if (result.error) {
      console.error("Resend Fehler:", result.error);
      return NextResponse.json(
        { error: "Resend konnte nicht senden." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("Server Fehler:", error);
    return NextResponse.json(
      { error: "Serverfehler", details: error.message },
      { status: 500 }
    );
  }
}
