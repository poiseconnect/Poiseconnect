export const dynamic = "force-dynamic";

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
  return RED_FLAGS.some((f) => text.toLowerCase().includes(f));
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

    const critical =
      isRedFlag(anliegen) ||
      isRedFlag(verlauf) ||
      isRedFlag(ziel);

    const subject = critical
      ? "⚠️ Kritischer Fall — Bitte prüfen"
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

${critical
  ? "⚠️ RED-FLAG — bitte intern prüfen."
  : `Gewählter Termin: ${terminDisplay}`
}
    `.trim();

    const result = await resend.emails.send({
      from: "hallo@mypoise.de",
      to: "hallo@mypoise.de",
      subject,
      text,
    });

    // IMPORTANT: Kein weiteres return nach diesem!
    if (result.error) {
      return NextResponse.json(
        { error: "RESEND_ERROR", detail: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: err.message },
      { status: 500 }
    );
  }
}
