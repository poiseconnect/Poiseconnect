export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

// Begriffe, bei denen ihr lieber kein Online-Setting machen wollt
const RED_FLAGS = [
  "suizid", "selbstmord", "selbstverletzung", "ritzen",
  "magersucht", "anorexie", "bulimie", "bulimia", "erbrechen",
  "binge", "essstörung", "essstoerung",
  "zwang", "halluzination", "wahn", "psychose", "schizophren",
  "borderline", "ptbs", "trauma", "bipolar"
];

function isRedFlag(text) {
  if (!text) return false;
  const t = String(text).toLowerCase();
  return RED_FLAGS.some((flag) => t.includes(flag));
}

export async function POST(request) {
  try {
    // Body lesen
    const data = await request.json();

    const {
      anliegen = "",
      verlauf = "",
      ziel = "",
      wunschtherapeut = "",
      vorname = "",
      nachname = "",
      email = "",
      adresse = "",
      geburtsdatum = "",
      beschaeftigungsgrad = "",
      terminDisplay = "",
    } = data ?? {};

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
  : `Gewählter Termin: ${terminDisplay}`}
    `.trim();

    // E-Mail über Resend schicken
    const { data: resendData, error } = await resend.emails.send({
      from: "hallo@mypoise.de",
      to: "hallo@mypoise.de",
      subject,
      text,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { ok: false, error: "RESEND_ERROR", detail: String(error) },
        { status: 500 }
      );
    }

    // Erfolgreiche Antwort
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", detail: String(err) },
      { status: 500 }
    );
  }
}
