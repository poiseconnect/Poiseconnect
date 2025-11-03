"use client";

import { useState } from "react";
import StepIndicator from "./components/StepIndicator";

export default function Home() {
  const [step, setStep] = useState(0);
  const totalSteps = 9;

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
    strasse: "",
    plz: "",
    ort: "",
    geburtsdatum: "",
    beschaeftigungsgrad: "",
    check_datenschutz: false,
  });

  const team = [
    "Linda","Ann","Anna","Anja","Babette","Carolin","Caroline","Elena","Franziska",
    "Gerhard","Gesine","Isabella","Jenny","Judith","Julius","Kristin","Kristin-Sofie",
    "Livia","Magdalena","Marisa","Marleen","Sophie","Yanina","Keine Präferenz",
  ];

  // Altersprüfung (min. 18)
  const isAdult = (dateString) => {
    const today = new Date();
    const birth = new Date(dateString);
    const age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    return age > 18 || (age === 18 && m >= 0);
  };

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => s - 1);

  const send = async () => {
    const res = await fetch("/api/submit", {
      method: "POST",
      body: JSON.stringify(form),
      headers: { "Content-Type": "application/json" }
    });

    alert(res.ok ? "Danke — deine Anfrage wurde gesendet." : "Fehler — bitte erneut versuchen.");
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <StepIndicator step={step} total={totalSteps} />

      {/* STEP 0 */}
      {step === 0 && (
        <div className="step-container">
          <h2>Anliegen</h2>
          <textarea
            placeholder="Wobei dürfen wir dich unterstützen?"
            value={form.anliegen}
            onChange={(e) => setForm({ ...form, anliegen: e.target.value })}
          />
          <div className="footer-buttons">
            <span />
            <button onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* STEP 1 */}
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

      {/* STEP 2 */}
      {step === 2 && (
        <div className="step-container">
          <h2>Wie lange leidest du schon an deinem Thema?</h2>
          <textarea
            placeholder="Gerne ein paar Sätze dazu…"
            value={form.verlauf}
            onChange={(e) => setForm({ ...form, verlauf: e.target.value })}
          />
          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* STEP 3 - DIAGNOSE */}
      {step === 3 && (
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

      {/* STEP 4 */}
      {step === 4 && (
        <div className="step-container">
          <h2>Ziel</h2>
          <textarea
            placeholder="Was wünschst du dir von der Begleitung?"
            value={form.ziel}
            onChange={(e) => setForm({ ...form, ziel: e.target.value })}
          />
          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* STEP 5 */}
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

      {/* STEP 6 - CONTACT */}
      {step === 6 && (
        <div className="step-container">
          <h2>Kontaktdaten</h2>

          <input placeholder="Vorname" value={form.vorname} onChange={(e) => setForm({ ...form, vorname: e.target.value })}/>
          <input placeholder="Nachname" value={form.nachname} onChange={(e) => setForm({ ...form, nachname: e.target.value })}/>
          <input type="email" placeholder="E-Mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/>
          <input placeholder="Straße & Nr." value={form.strasse} onChange={(e) => setForm({ ...form, strasse: e.target.value })}/>
          <input placeholder="PLZ" value={form.plz} onChange={(e) => setForm({ ...form, plz: e.target.value })}/>
          <input placeholder="Ort" value={form.ort} onChange={(e) => setForm({ ...form, ort: e.target.value })}/>
          
          <input 
            type="date" 
            value={form.geburtsdatum}
            onChange={(e) => setForm({ ...form, geburtsdatum: e.target.value })}
          />

          {!isAdult(form.geburtsdatum) && form.geburtsdatum && (
            <p style={{ color: "red" }}>⚠ Du musst mindestens 18 Jahre alt sein.</p>
          )}

          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button disabled={!isAdult(form.geburtsdatum)} onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* STEP 7 */}
      {step === 7 && (
        <div className="step-container">
          <h2>Beschäftigungsgrad</h2>
          <select
            value={form.beschaeftigungsgrad}
            onChange={(e) => setForm({ ...form, beschaeftigungsgrad: e.target.value })}
          >
            <option value="">Bitte auswählen…</option>
            <option>Angestellt</option>
            <option>Selbstständig</option>
            <option>Arbeitssuchend</option>
            <option>Schule / Studium</option>
          </select>
          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* STEP 8 */}
      {step === 8 && (
        <div className="step-container">
          <h2>Datenschutz</h2>

          <label>
            <input
              type="checkbox"
              checked={form.check_datenschutz}
              onChange={() => setForm({ ...form, check_datenschutz: !form.check_datenschutz })}
            />
            &nbsp;Ich akzeptiere die Datenschutzerklärung.
          </label>

          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button disabled={!form.check_datenschutz} onClick={send}>Senden</button>
          </div>
        </div>
      )}
    </div>
  );
}
