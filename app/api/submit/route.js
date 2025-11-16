import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ---------------------------
// RED FLAGS (überarbeitet)
// ---------------------------
const RED_FLAGS = [
  // Akut gefährlich
  "suizid", "selbstmord", "selbsttötung", "selbsttoetung",
  "selbstverletzung", "ritzen", "svv",

  // Essstörungen
  "magersucht", "anorexie", "anorexia",
  "bulimie", "bulimia",
  "binge eating", "essstörung", "essstoerung",

  // Trauma & PTBS
  "trauma", "ptbs", "posttraumatisch", "flashbacks",
  "trigger", "übererregung", "hypervigilanz",

  // Zwangsstörungen
  "zwang", "zwangsgedanken", "zwangshandlungen", "ocd",

  // Psychosen / Schizophrenie
  "psychose", "psychotisch", "halluzination", "wahn", "schizophrenie",

  // Sucht / Abhängigkeit
  "abhängigkeit", "abhaengigkeit", "sucht",
  "alkoholproblem", "alkoholsucht",
  "drogen", "drogensucht", "kokain", "heroin", "cannabisabhängigkeit",
  "glücksspiel", "gambling",

  // Borderline
  "borderline", "bpd", "instabile beziehungen", "leeregefühl",

  // Bipolar
  "bipolar", "manie", "manisch", "hypomanie"
];

function isRedFlag(text) {
  if (!text) return false;
  const t = String(text).toLowerCase();
  return RED_FLAGS.some((flag) => t.includes(flag));
}

// ---------------------------
// POST
// ---------------------------
export async function POST(request) {
  try {
    // ----- Body holen -----
    let data;
    try {
      data = await request.json();
    } catch (err) {
      console.error("❌ JSON Parse Error:", err);
      return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
    }

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

    // ----- RED FLAGS check -----
    const isCritical =
      isRedFlag(anliegen) ||
      isRedFlag(verlauf) ||
      isRedFlag(ziel);

    const subject = isCritical
      ? `⚠️ Kritischer Fall — Bitte Rückmeldung`
      : `Neue Anfrage — ${vorname} ${nachname}`;

    // ----- Mailtext -----
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
  ? `⚠️ Red-Flag erkannt → Bitte intern abklären.`
  : `Gewählter Termin: ${terminDisplay}`
}
`.trim();

    // ---------------------------
    // RESEND SENDEN
    // ---------------------------
    let result;
    try {
      result = await resend.emails.send({
        from: "hallo@mypoise.de",
        to: "hallo@mypoise.de",
        subject,
        text,
      });
    } catch (err) {
      console.error("❌ Resend API Fehler:", err);
      return NextResponse.json(
        { error: "Resend konnte nicht senden (API-Fehler)." },
        { status: 500 }
      );
    }

    if (result?.error) {
      console.error("❌ Resend Fehler:", result.error);
      return NextResponse.json(
        { error: "Resend konnte nicht senden (Validation-Error)." },
        { status: 500 }
      );
    }

    console.log("✅ Resend OK:", result?.id || "OK");

    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (err) {
    console.error("❌ Server-Fehler:", err);
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}
