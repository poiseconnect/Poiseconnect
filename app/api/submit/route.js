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
  return RED_FLAGS.some((flag) =>
    text.toLowerCase().includes(flag)
  );
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

    const message = `
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
  ? "⚠️ Red-Flag erkannt – bitte intern prüfen."
  : `Gewählter Termin: ${terminDisplay}`}
`.trim();

    // ---- E-Mail senden ----
    const sent = await resend.emails.send({
      from: "hallo@mypoise.de",
      to: "hallo@mypoise.de",
      subject,
      text: message,
    });

    if (sent.error) {
      return NextResponse.json(
        { ok: false, error: sent.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || "Serverfehler" },
      { status: 500 }
    );
  }
}
