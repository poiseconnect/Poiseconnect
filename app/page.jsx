"use client";

import { useState } from "react";
import Image from "next/image";
import StepIndicator from "./components/StepIndicator";

export default function Home() {
  const [step, setStep] = useState(0);
  const totalSteps = 9;

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
  });

  const team = [
    "Linda", "Ann", "Anna", "Anja", "Babette", "Carolin", "Caroline", "Elena",
    "Franziska", "Gerhard", "Gesine", "Isabella", "Jenny", "Judith", "Julius",
    "Kristin", "Kristin-Sofie", "Livia", "Magdalena", "Marisa", "Marleen",
    "Sophie", "Yanina", "Keine Präferenz",
  ];

  const isAdult = (dateString) => {
    const birth = new Date(dateString);
    const age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    return age > 18 || (age === 18 && m >= 0);
  };

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
    <div className="form-wrapper">

      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <Image 
          src="/IMG_7599.png"   // <— genau so, weil Datei in /public liegt
          alt="Poise Logo"
          width={160}
          height={160}
          priority
        />
      </div>

      <StepIndicator step={step} total={totalSteps} />

      {/* ---------- STEP 0 Anliegen ---------- */}
      {step === 0 && (
        <div className="step-container">
          <h2>Anliegen</h2>
          <textarea
            placeholder="Wobei dürfen wir dich begleiten?"
            value={form.anliegen}
            onChange={(e) => setForm({ ...form, anliegen: e.target.value })}
          />
          <div className="footer-buttons">
            <span />
            <button disabled={!form.anliegen} onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* ---------- STEP 1 Leidensdruck ---------- */}
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
            <button disabled={!form.leidensdruck} onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* ---------- STEP 2 Verlauf ---------- */}
      {step === 2 && (
        <div className="step-container">
          <h2>Wie lange leidest du schon an deinem Thema?</h2>
          <textarea
            placeholder="z. B. Seit 3 Jahren, seit der Kindheit, etc."
            value={form.verlauf}
            onChange={(e) => setForm({ ...form, verlauf: e.target.value })}
          />
          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button disabled={!form.verlauf} onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* ---------- STEP 3 Diagnose ---------- */}
      {step === 3 && (
        <div className="step-container">
          <h2>Gibt es eine Diagnose?</h2>
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
            <button disabled={!form.diagnose} onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* ---------- STEP 4 Ziel ---------- */}
      {step === 4 && (
        <div className="step-container">
          <h2>Was wünschst du dir von dem Coaching?</h2>
          <textarea
            placeholder="Formuliere das Ziel oder die gewünschte Veränderung…"
            value={form.ziel}
            onChange={(e) => setForm({ ...form, ziel: e.target.value })}
          />
          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button disabled={!form.ziel} onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* ---------- STEP 5 Matching: Team-Auswahl ---------- */}
{step === 5 && (
  <div className="step-container">
    <h2>Wer könnte gut zu dir passen?</h2>

    <p style={{textAlign: "center", marginBottom: 20}}>
      Wähle eine Person aus unserem Team, die dich begleiten darf.
    </p>

    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
      gap: "20px",
      justifyItems: "center"
    }}>
      {teamData.map((m) => (
        <div key={m.name} 
          style={{
            borderRadius: 12,
            padding: 16,
            textAlign: "center",
            width: "100%",
            maxWidth: 260,
            background: m.status === "warteliste" ? "#f4f4f4" : "white",
            opacity: m.status === "warteliste" ? 0.5 : 1,
            cursor: m.status === "warteliste" ? "not-allowed" : "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,.08)"
          }}
          onClick={() => m.status === "frei" && setForm({ ...form, wunschtherapeut: m.name })}
        >
          <img 
            src={m.image}
            alt={m.name}
            style={{width: "100%", borderRadius: 12, marginBottom: 12}}
          />
          <h3 style={{margin: "6px 0"}}>{m.name}</h3>
          <p style={{fontSize: 14, opacity: .8}}>{m.role}</p>

          {m.status === "frei" ? (
            <button style={{marginTop: 12}}>Auswählen</button>
          ) : (
            <p style={{marginTop: 12, color: "gray"}}>Zurzeit Warteliste</p>
          )}
        </div>
      ))}
    </div>

    <div className="footer-buttons">
      <button onClick={back}>Zurück</button>
      <button disabled={!form.wunschtherapeut} onClick={next}>Weiter</button>
    </div>
  </div>
)}


      {/* ---------- STEP 6 Kontaktdaten ---------- */}
      {step === 6 && (
        <div className="step-container">
          <h2>Kontaktdaten</h2>

          <input placeholder="Vorname" value={form.vorname} onChange={(e) => setForm({ ...form, vorname: e.target.value })}/>
          <input placeholder="Nachname" value={form.nachname} onChange={(e) => setForm({ ...form, nachname: e.target.value })}/>
          <input type="email" placeholder="E-Mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/>
          <input placeholder="Adresse" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })}/>
          <input type="date" value={form.geburtsdatum} onChange={(e) => setForm({ ...form, geburtsdatum: e.target.value })}/>

          {!isAdult(form.geburtsdatum) && form.geburtsdatum && (
            <p style={{ color: "red" }}>Du musst mindestens 18 Jahre alt sein.</p>
          )}

          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button
              disabled={
                !form.vorname ||
                !form.nachname ||
                !form.email ||
                !form.adresse ||
                !form.geburtsdatum ||
                !isAdult(form.geburtsdatum)
              }
              onClick={next}
            >
              Weiter
            </button>
          </div>
        </div>
      )}

      {/* ---------- STEP 7 Beschäftigungsgrad ---------- */}
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
            <option>Schule/Studium</option>
          </select>

          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button disabled={!form.beschaeftigungsgrad} onClick={next}>
              Weiter
            </button>
          </div>
        </div>
      )}

      {/* ---------- STEP 8 Datenschutz ---------- */}
      {step === 8 && (
        <div className="step-container">
          <h2>Datenschutz</h2>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.check_datenschutz}
              onChange={() =>
                setForm({ ...form, check_datenschutz: !form.check_datenschutz })
              }
            />
            Ich akzeptiere die Datenschutzerklärung.
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
