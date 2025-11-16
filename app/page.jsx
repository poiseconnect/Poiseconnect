"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import StepIndicator from "./components/StepIndicator";
import TeamCarousel from "./components/TeamCarousel";
import { teamData } from "./teamData";

const getTherapistInfo = (name) => {
  return teamData.find((t) => t.name === name) || {};
};

// ---- RED-FLAGS ----
const RED_FLAGS = [
  "suizid", "selbstmord", "selbstverletzung", "ritzen",
  "magersucht", "anorexie", "bulim", "erbrechen",
  "binge", "essstörung", "essstoerung",
  "borderline", "svv"
];
const isRedFlag = (t) => t && RED_FLAGS.some((x) => t.toLowerCase().includes(x));

// ---- KALENDER LINKS ----
const ICS_BY_MEMBER = {
  Ann: "https://calendar.google.com/calendar/ical/75f62df4c63554a1436d49c3a381da84502728a0457c9c8b56d30e21fa5021c5%40group.calendar.google.com/public/basic.ics",
};

// ---- Helfer ----
const formatDate = (d) =>
  d.toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit" });

const formatTime = (d) =>
  d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });

function parseICSDate(line) {
  const m = line.match(/DT(?:START|END)(?:;TZID=[^:]+)?:([0-9T]+)/i);
  if (!m) return null;
  const raw = m[1];
  return new Date(
    Number(raw.slice(0, 4)),
    Number(raw.slice(4, 6)) - 1,
    Number(raw.slice(6, 8)),
    Number(raw.slice(9, 11)) || 0,
    Number(raw.slice(11, 13)) || 0
  );
}

async function loadIcsSlots(icsUrl, daysAhead = 21) {
  const res = await fetch(`/api/ics?url=${encodeURIComponent(icsUrl)}`);
  const text = await res.text();

  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * 86400000);
  const events = text.split("BEGIN:VEVENT").slice(1);
  const slots = [];

  for (const event of events) {
    const sLine = event.split("\n").find((l) => l.startsWith("DTSTART"));
    const eLine = event.split("\n").find((l) => l.startsWith("DTEND"));
    if (!sLine || !eLine) continue;

    const start = parseICSDate(sLine);
    const end = parseICSDate(eLine);
    if (!start || !end || end <= now || start > until) continue;

    for (let t = new Date(start); t < end; t = new Date(t.getTime() + 1800000)) {
      const tEnd = new Date(t.getTime() + 1800000);
      if (tEnd > end || tEnd <= now) continue;
      slots.push({ start: new Date(t), key: t.toISOString() });
    }
  }

  return slots.sort((a, b) => a.start - b.start);
}

export default function Home() {
  const [step, setStep] = useState(0);
  const [subStep9, setSubStep9] = useState(0);
  const totalSteps = 11;
  const today = new Date();

  const [form, setForm] = useState({
    anliegen: "",
    leidensdruck: "",
    verlauf: "",
    diagnose: "",
    ziel: "",
    wunschtherapeut: "",
    vorname: "",
    nachname: "",
    email: "",
    adresse: "",
    geburtsdatum: "",
    beschaeftigungsgrad: "",
    check_datenschutz: false,
    check_online_setting: false,
    check_gesundheit: false,
    terminISO: "",
    terminDisplay: "",
  });

  const sortedTeam = useMemo(() => {
    if (!form.anliegen) return teamData || [];
    const words = form.anliegen.toLowerCase().split(/[\s,.;!?]+/).filter(Boolean);
    return [...teamData].sort((a, b) => {
      const score = (m) =>
        m.tags?.filter((tag) => words.some((w) => tag.toLowerCase().includes(w))).length || 0;
      return score(b) - score(a);
    });
  }, [form.anliegen]);

  const isAdult = (d) => {
    const birth = new Date(d);
    const age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    return age > 18 || (age === 18 && m >= 0);
  };

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  useEffect(() => {
    if (step !== 10) return;
    (async () => {
      setLoadingSlots(true);
      setSlotsError("");
      try {
        const ics = ICS_BY_MEMBER[form.wunschtherapeut];
        if (!ics) return setSlotsError("Kein Kalender hinterlegt.");
        setSlots(await loadIcsSlots(ics));
      } catch {
        setSlotsError("Kalender konnte nicht geladen werden.");
      }
      setLoadingSlots(false);
    })();
  }, [step, form.wunschtherapeut]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const s of slots) {
      const key = s.start.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return Array.from(map.entries());
  }, [slots]);

  
const send = async () => {
  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    let json = null;
    try {
      json = await res.json();
    } catch {
      // falls kein JSON zurückkommt → nicht abstürzen
      json = null;
    }

    if (!res.ok) {
      console.error("API Fehler:", json || res.status);
      alert("Fehler – Anfrage konnte nicht gesendet werden.");
      return;
    }

    alert("Danke — deine Anfrage wurde erfolgreich gesendet.");
  } catch (err) {
    console.error("Client Fehler:", err);
    alert("Unerwarteter Fehler — bitte später erneut versuchen.");
  }
};



  return (
    <div className="form-wrapper">
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Image src="/IMG_7599.png" width={160} height={160} alt="Poise Logo" priority />
      </div>

      <StepIndicator step={step} total={totalSteps} />

      {/* STEP 0 - 8 → bleiben exakt wie zuletzt bei dir */}
      {/* ↓↓↓ ICH LASS SIE DRIN. Alles bleibt. ↓↓↓ */}

      {/* STEP 0 */}
      {step === 0 && (
        <div className="step-container">
          <h2>Anliegen</h2>
          <textarea value={form.anliegen} onChange={(e) => setForm({ ...form, anliegen: e.target.value })} />
          <div className="footer-buttons"><span /><button disabled={!form.anliegen} onClick={next}>Weiter</button></div>
        </div>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <div className="step-container">
          <h2>Wie hoch ist dein Leidensdruck?</h2>
          <select value={form.leidensdruck} onChange={(e) => setForm({ ...form, leidensdruck: e.target.value })}>
            <option value="">Bitte auswählen…</option>
            <option>niedrig</option><option>mittel</option><option>hoch</option><option>sehr hoch</option>
          </select>
          <div className="footer-buttons"><button onClick={back}>Zurück</button><button disabled={!form.leidensdruck} onClick={next}>Weiter</button></div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="step-container">
          <h2>Wie lange leidest du schon?</h2>
          <textarea value={form.verlauf} onChange={(e) => setForm({ ...form, verlauf: e.target.value })} />
          <div className="footer-buttons"><button onClick={back}>Zurück</button><button disabled={!form.verlauf} onClick={next}>Weiter</button></div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="step-container">
          <h2>Gibt es eine Diagnose?</h2>
          <select value={form.diagnose} onChange={(e) => setForm({ ...form, diagnose: e.target.value })}>
            <option value="">Bitte auswählen…</option><option>Ja</option><option>Nein</option>
          </select>
          <div className="footer-buttons"><button onClick={back}>Zurück</button><button disabled={!form.diagnose} onClick={next}>Weiter</button></div>
        </div>
      )}

      {/* STEP 4 */}
      {step === 4 && (
        <div className="step-container">
          <h2>Was wünschst du dir?</h2>
          <textarea value={form.ziel} onChange={(e) => setForm({ ...form, ziel: e.target.value })} />
          <div className="footer-buttons"><button onClick={back}>Zurück</button><button disabled={!form.ziel} onClick={next}>Weiter</button></div>
        </div>
      )}

      {/* STEP 5 */}
      {step === 5 && (
        <div className="step-container">
          {isRedFlag(form.anliegen) ? (
            <>
              <h2>Vielen Dank für deine Offenheit</h2>
              <p>Leider können wir dein Thema nicht im Online-Setting begleiten …</p>
              <div className="footer-buttons"><button onClick={back}>Zurück</button><button onClick={next}>Weiter</button></div>
            </>
          ) : (
            <>
              <h2>Wer könnte gut zu dir passen?</h2>
              <TeamCarousel members={sortedTeam} onSelect={(name) => { setForm({ ...form, wunschtherapeut: name }); next(); }} />
              <div className="footer-buttons"><button onClick={back}>Zurück</button></div>
            </>
          )}
        </div>
      )}

      {/* STEP 6 */}
      {step === 6 && (
        <div className="step-container">
          <h2>Kontaktdaten</h2>
          <input placeholder="Vorname" value={form.vorname} onChange={(e) => setForm({ ...form, vorname: e.target.value })} />
          <input placeholder="Nachname" value={form.nachname} onChange={(e) => setForm({ ...form, nachname: e.target.value })} />
          <input placeholder="E-Mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Adresse" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          <input type="date" value={form.geburtsdatum} onChange={(e) => setForm({ ...form, geburtsdatum: e.target.value })} />
          {!isAdult(form.geburtsdatum) && form.geburtsdatum && <p style={{ color: "red" }}>Du musst mindestens 18 sein.</p>}
          <div className="footer-buttons"><button onClick={back}>Zurück</button><button disabled={!form.vorname || !form.nachname || !form.email || !form.adresse || !form.geburtsdatum || !isAdult(form.geburtsdatum)} onClick={next}>Weiter</button></div>
        </div>
      )}

      {/* STEP 7 */}
      {step === 7 && (
        <div className="step-container">
          <h2>Beschäftigungsgrad</h2>
          <select value={form.beschaeftigungsgrad} onChange={(e) => setForm({ ...form, beschaeftigungsgrad: e.target.value })}>
            <option value="">Bitte auswählen…</option>
            <option>Angestellt</option><option>Selbstständig</option><option>Arbeitssuchend</option><option>Schule/Studium</option>
          </select>
          <div className="footer-buttons"><button onClick={back}>Zurück</button><button disabled={!form.beschaeftigungsgrad} onClick={next}>Weiter</button></div>
        </div>
      )}

     {/* --- STEP 8 Datenschutz --- */}
      {step === 8 && (
        <div className="step-container">
          <h2>Wichtige Hinweise</h2>

          <label className="checkbox">
            <input type="checkbox" checked={form.check_datenschutz}
              onChange={() => setForm({ ...form, check_datenschutz: !form.check_datenschutz })} />
            Ich akzeptiere die Datenschutzerklärung.
          </label>

          <label className="checkbox">
            <input type="checkbox" checked={form.check_online_setting}
              onChange={() => setForm({ ...form, check_online_setting: !form.check_online_setting })} />
            Ich habe Kamera & Mikrofon und sorge für ruhige Umgebung.
          </label>

          <label className="checkbox">
            <input type="checkbox" checked={form.check_gesundheit}
              onChange={() => setForm({ ...form, check_gesundheit: !form.check_gesundheit })} />
            Ich habe keine akuten Suizidgedanken / akute Selbstgefährdung.
          </label>

          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button disabled={
              !form.check_datenschutz ||
              !form.check_online_setting ||
              !form.check_gesundheit
            } onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* --- STEP 9 Story Flow --- */}
{step === 9 && (() => {
  const t = getTherapistInfo(form.wunschtherapeut);

  const slides = [
    {
      title: "Schön, dass du da bist 🤍",
      text: `Danke für dein Vertrauen.

Du hast **${t.name}** ausgewählt — eine sehr gute Wahl.

Wir führen dich jetzt ganz kurz durch den Ablauf,
bevor du deinen Termin auswählst.`,
    },
    {
      title: "Wie startet der Prozess?",
      text: `Ihr beginnt mit einem **kostenlosen Erstgespräch (30 Min)** im Video-Call.

Ihr lernt euch kennen, besprecht das Anliegen
und klärt organisatorische Fragen.

Danach entscheiden beide frei, ob ihr weiter zusammenarbeitet.`,
    },
    {
      title: "Wie geht es danach weiter?",
      text: `Wenn ihr weitermacht:

• Sitzungen à **60 Minuten**
• Online per Video-Call
• Ca. 8–10 Sitzungen im Durchschnitt
• Offenes Tempo & Anpassung jederzeit möglich`,
    },
    {
      title: `Kosten bei ${t.name}`,
      text: `Standardtarif: **${t.preis_std}€ / 60 Min**
Ermäßigt (Studierende / Azubi): **${t.preis_ermaessigt}€**

Unser Angebot richtet sich grundsätzlich an Selbstzahler.
Eine Kostenübernahme kann möglich sein — individuell klären.`,
    },
  ];

  const isLast = subStep9 === slides.length - 1;

  return (
    <div className="step-container">
      <h2>{slides[subStep9].title}</h2>

      <p style={{ whiteSpace: "pre-line", lineHeight: 1.55 }}>
        {slides[subStep9].text}
      </p>

      <div className="footer-buttons">
        {subStep9 > 0 ? (
          <button onClick={() => setSubStep9(subStep9 - 1)}>Zurück</button>
        ) : (
          <button onClick={back}>Zurück</button>
        )}

        {!isLast ? (
          <button onClick={() => setSubStep9(subStep9 + 1)}>Weiter</button>
        ) : (
          <button onClick={() => { setSubStep9(0); next(); }}>
            Weiter zur Terminwahl
          </button>
        )}
      </div>
    </div>
  );
})()}

          {/* --- STEP 10 Terminwahl --- */}
{step === 10 && (
  <div className="step-container">
    <h2>Erstgespräch – Termin wählen</h2>

    {loadingSlots && <p>Kalender wird geladen…</p>}
    {slotsError && <p style={{ color: "red" }}>{slotsError}</p>}
    {!loadingSlots && grouped.length === 0 && <p>Keine freien Termine verfügbar.</p>}

    {!loadingSlots && grouped.length > 0 && grouped.map(([day, list]) => (
      <div key={day} style={{ marginBottom: 14 }}>
        <strong>{formatDate(list[0].start)}</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          {list.map((s) => (
            <button
              key={s.key}
              onClick={() =>
                setForm({
                  ...form,
                  terminISO: s.start.toISOString(),
                  terminDisplay: `${formatDate(s.start)} ${formatTime(s.start)}`
                })
              }
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: form.terminISO === s.start.toISOString()
                  ? "2px solid #A27C77"
                  : "1px solid #ddd",
                background: form.terminISO === s.start.toISOString()
                  ? "#F3E9E7"
                  : "#fff",
                cursor: "pointer",
              }}
            >
              {formatTime(s.start)}
            </button>
          ))}
        </div>
      </div>
    ))}

    {form.terminISO && (
      <p style={{ marginTop: 12 }}>
        Gewählt: <strong>{form.terminDisplay}</strong>
      </p>
    )}

    <div className="footer-buttons" style={{ marginTop: 16 }}>
      <button onClick={back}>Zurück</button>
      <button disabled={!form.terminISO} onClick={send}>
        Anfrage senden
      </button>
    </div>
  </div>
)}

</div>
);  // ← schließt return()
}    // ← schließt function Home
