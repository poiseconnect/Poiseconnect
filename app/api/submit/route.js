import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Die gleichen Red-Flag-Begriffe wie im Frontend
const RED_FLAGS = [
  "suizid", "selbstmord", "selbstverletzung", "ritzen",
  "magersucht", "anorexie", "bulimie", "bulimia", "erbrechen",
  "binge", "binge eating", "essstörung", "essstoerung",
  "borderline", "svv"
];

function isRedFlag(text) {
  if (!text) return false;
  const t = String(text || "").toLowerCase();
  return RED_FLAGS.some((flag) => t.includes(flag));
}

export async function POST(req) {
  try {
    const data = await req.json();

    const {
      anliegen,
      leidensdruck,
      verlauf,
      diagnose,
      ziel,
      wunschtherapeut,
      vorname,
      nachname,
      email,
      adresse,
      geburtsdatum,
      beschaeftigungsgrad,
      terminDisplay
    } = data;

    // Prüfen ob kritischer Fall
    const isCritical = isRedFlag(anliegen || "") || isRedFlag(verlauf || "") || isRedFlag(ziel || "");

    let subject;
    let message;

    if (isCritical) {
      // Nur interne Info → KEIN Termin, KEINE Weiterleitung
      subject = `⚠️ Kritischer Fall — Bitte Rückmeldung`;
      message = `
Kritische Anfrage eingegangen.

--- Daten ---

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

⚠️ Hinweis:
Red-Flag erkannt → Bitte Absage-Mail senden.
      `.trim();
    } else {
      // Normale Anfrage mit Termin
      subject = `Neue Anfrage — ${vorname} ${nachname}`;
      message = `
Neue Anfrage eingegangen:

--- Persönliche Daten ---
Name: ${vorname} ${nachname}
E-Mail: ${email}
Adresse: ${adresse}
Geburtsdatum: ${geburtsdatum}
Beschäftigung: ${beschaeftigungsgrad}

--- Anliegen ---
${anliegen}

--- Verlauf ---
${verlauf}

--- Ziel ---
${ziel}

--- Wunsch-Begleitung ---
${wunschtherapeut || "Noch nicht gewählt"}

--- Gewählter Termin ---
${terminDisplay || "Kein Termin gewählt"}

Bitte anrufen / schreiben für Erstkontakt.
      `.trim();
    }

    // Mail versenden
    await resend.emails.send({
      from: "hallo@mypoise.de",
      to: "hallo@mypoise.de",
      subject,
      text: message,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Fehler beim Versenden" }, { status: 500 });
  }
}
