"use client";

import { useState } from "react";
import StepIndicator from "./components/StepIndicator";

export default function Home() {
  const [step, setStep] = useState(0);

  // Jetzt 8 Schritte (0–7)
  const totalSteps = 8;

  const [form, setForm] = useState({
    anliegen: "",
    leidensdruck: "",
    verlauf: "",
    ziel: "",
    diagnose: "",
    wunschtherapeut: "",
    vorname: "",
    nachname: "",
    email: "",
    plz: "",
    ort: "",
    strasse: "",
    beschaeftigungsgrad: "",
    check_datenschutz: false,
  });

  const team = [
    "Linda", "Ann", "Anna", "Anja", "Babette", "Carolin", "Caroline", "Elena",
    "Franziska", "Gerhard", "Gesine", "Isabella", "Jenny", "Judith", "Julius",
    "Kristin", "Kristin-Sofie", "Livia", "Magdalena", "Marisa", "Marleen",
    "Sophie", "Yanina", "Keine Präferenz",
  ];

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  const send = async () => {
    const res = await fetch("/api/submit", {
      method: "POST",
      body: JSON.stringify(form),
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      alert("Danke — deine Anfrage wurde erfolgreich gesendet.");
      setStep(0);
    } else {
      alert("Fehler — bitte versuche es erneut.");
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <StepIndicator step={step} total={totalSteps} />

      {/* ------------------- STEP 0 --------------- */}
      {step === 0 && (
        <div className="step-container">
          <h2>Wobei dürfen wir dich begleiten?</h2>
          <textarea
            placeholder="Beschreibe dein Anliegen..."
            value={form.anliegen}
            onChange={(e) => setForm({ ...form, anliegen: e.target.value })}
          />
          <div className="footer-buttons">
            <span />
            <button onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* ------------------- STEP 1 --------------- */}
      {step === 1 && (
        <div className="step-container">
          <h2>Wie hoch ist dein Leidensdruck?</h2>
          <select
            value={form.leidensdruck}
            onChange={(e) => setForm({ ...form, leidensdruck: e.target.value })}
          >
            <option value="">Bitte auswählen…</option>
            <option>niedrig</option>
            <option>mittel</option>
            <option>hoch</option>
            <option>sehr hoch</option>
          </select>

          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* ------------------- STEP 2 --------------- */}
      {step === 2 && (
        <div className="step-container">
          <h2>Wie sieht der bisherige Verlauf aus?</h2>
          <textarea
            placeholder="Wie lange leidest du schon an deinem Thema?"
            value={form.verlauf}
            onChange={(e) => setForm({ ...form, verlauf: e.target.value })}
          />
          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* ------------------- STEP 3 --------------- */}
      {step === 3 && (
        <div className="step-container">
          <h2>Ziel</h2>
          <textarea
            placeholder="Was wünschst du dir von einem Coaching?"
            value={form.ziel}
            onChange={(e) => setForm({ ...form, ziel: e.target.value })}
          />
          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* ------------------- STEP 4 (Diagnose) --------------- */}
      {step === 4 && (
        <div className="step-container">
          <h2>Gibt es bereits eine Diagnose?</h2>
          <select
            value={form.diagnose}
            onChange={(e) => setForm({ ...form, diagnose: e.target.value })}
          >
            <option value="">Bitte auswählen…</option>
            <option>Ja</option>
            <option>Nein</option>
          </select>

          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* ------------------- STEP 5 --------------- */}
      {step === 5 && (
        <div className="step-container">
          <h2>Wunschtherapeut*in</h2>
          <select
            value={form.wunschtherapeut}
            onChange={(e) => setForm({ ...form, wunschtherapeut: e.target.value })}
          >
            <option value="">Keine Präferenz</option>
            {team.map((t) => <option key={t}>{t}</option>)}
          </select>

          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* ------------------- STEP 6 Kontaktdaten --------------- */}
      {step === 6 && (
        <div className="step-container">
          <h2>Deine Kontaktdaten</h2>

          <input placeholder="Vorname" value={form.vorname} onChange={(e) => setForm({ ...form, vorname: e.target.value })}/>
          <input placeholder="Nachname" value={form.nachname} onChange={(e) => setForm({ ...form, nachname: e.target.value })}/>
          <input type="email" placeholder="E-Mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/>
          <input placeholder="Postleitzahl" value={form.plz} onChange={(e) => setForm({ ...form, plz: e.target.value })}/>
          <input placeholder="Ort" value={form.ort} onChange={(e) => setForm({ ...form, ort: e.target.value })}/>
          <input placeholder="Straße, Hausnummer" value={form.strasse} onChange={(e) => setForm({ ...form, strasse: e.target.value })}/>

          <select
            value={form.beschaeftigungsgrad}
            onChange={(e) => setForm({ ...form, beschaeftigungsgrad: e.target.value })}
          >
            <option value="">Beschäftigungsstatus…</option>
            <option>Angestellt</option>
            <option>Selbstständig</option>
            <option>Arbeitssuchend</option>
            <option>Schule/Studium</option>
          </select>

          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* ------------------- STEP 7 Datenschutz --------------- */}
      {step === 7 && (
        <div className="step-container">
          <h2>Datenschutz</h2>

          <p>
            Deine Daten werden streng vertraulich behandelt und nicht an Dritte weitergegeben.
          </p>

          <label>
            <input
              type="checkbox"
              checked={form.check_datenschutz}
              onChange={() =>
                setForm({ ...form, check_datenschutz: !form.check_datenschutz })
              }
            />{" "}
            Ich akzeptiere die Datenschutzerklärung
          </label>

          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button disabled={!form.check_datenschutz} onClick={send}>
              Anfrage senden
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
