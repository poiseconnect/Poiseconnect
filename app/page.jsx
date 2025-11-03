"use client";

import { useState } from "react";
import StepIndicator from "./components/StepIndicator";

export default function Home() {
  const [step, setStep] = useState(0);

  const [form, setForm] = useState({
    anliegen: "",
    leidensdruck: "",
    verlauf: "",
    ziel: "",
    wunschtherapeut: "",
    vorname: "",
    nachname: "",
    email: "",
    beschaeftigungsgrad: "",
    check_datenschutz: false,
  });

  const team = [
    "Linda", "Ann", "Anna", "Anja", "Babette", "Carolin", "Caroline", "Elena",
    "Franziska", "Gerhard", "Gesine", "Isabella", "Jenny", "Judith", "Julius",
    "Kristin", "Kristin-Sofie", "Livia", "Magdalena", "Marisa", "Marleen",
    "Sophie", "Yanina", "Keine Präferenz",
  ];

  const next = () => setStep(step + 1);
  const back = () => setStep(step - 1);

  const send = async () => {
    const res = await fetch("/api/submit", {
      method: "POST",
      body: JSON.stringify(form),
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      alert("Danke — deine Anfrage wurde gesendet.");
      setStep(0);
      setForm({
        anliegen: "",
        leidensdruck: "",
        verlauf: "",
        ziel: "",
        wunschtherapeut: "",
        vorname: "",
        nachname: "",
        email: "",
        beschaeftigungsgrad: "",
        check_datenschutz: false,
      });
    } else {
      alert("Fehler — bitte versuche es erneut.");
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>

      <StepIndicator step={step} total={7} />

      {step === 0 && (
        <>
          <h2>Wobei dürfen wir dich begleiten?</h2>
          <textarea
            placeholder="Beschreibe kurz dein Anliegen..."
            value={form.anliegen}
            onChange={(e) => setForm({ ...form, anliegen: e.target.value })}
          />
          <button onClick={next}>Weiter</button>
        </>
      )}

      {step === 1 && (
        <>
          <h2>Wie hoch ist dein Leidensdruck?</h2>
          <select
            value={form.leidensdruck}
            onChange={(e) => setForm({ ...form, leidensdruck: e.target.value })}
          >
            <option value="">Bitte wählen…</option>
            <option>niedrig</option>
            <option>mittel</option>
            <option>hoch</option>
            <option>sehr hoch</option>
          </select>
          <button onClick={back}>Zurück</button> <button onClick={next}>Weiter</button>
        </>
      )}

      {step === 2 && (
        <>
          <h2>Wie sieht der bisherige Verlauf aus?</h2>
          <textarea
            placeholder="Gab es bereits Therapie, Coaching oder Diagnosen?"
            value={form.verlauf}
            onChange={(e) => setForm({ ...form, verlauf: e.target.value })}
          />
          <button onClick={back}>Zurück</button> <button onClick={next}>Weiter</button>
        </>
      )}

      {step === 3 && (
        <>
          <h2>Wohin möchtest du?</h2>
          <textarea
            placeholder="Was ist dein Ziel?"
            value={form.ziel}
            onChange={(e) => setForm({ ...form, ziel: e.target.value })}
          />
          <button onClick={back}>Zurück</button> <button onClick={next}>Weiter</button>
        </>
      )}

      {step === 4 && (
        <>
          <h2>Wunschtherapeut*in?</h2>
          <select
            value={form.wunschtherapeut}
            onChange={(e) => setForm({ ...form, wunschtherapeut: e.target.value })}
          >
            <option value="">Keine Präferenz</option>
            {team.map((t) => <option key={t}>{t}</option>)}
          </select>
          <button onClick={back}>Zurück</button> <button onClick={next}>Weiter</button>
        </>
      )}

      {step === 5 && (
        <>
          <h2>Deine Daten</h2>
          <input placeholder="Vorname" value={form.vorname} onChange={(e) => setForm({ ...form, vorname: e.target.value })}/>
          <input placeholder="Nachname" value={form.nachname} onChange={(e) => setForm({ ...form, nachname: e.target.value })}/>
          <input type="email" placeholder="E-Mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/>
          <select
            value={form.beschaeftigungsgrad}
            onChange={(e) => setForm({ ...form, beschaeftigungsgrad: e.target.value })}
          >
            <option value="">Beschäftigungsgrad…</option>
            <option>Angestellt</option>
            <option>Selbstständig</option>
            <option>Arbeitssuchend</option>
            <option>Schüler/Student</option>
          </select>
          <button onClick={back}>Zurück</button> <button onClick={next}>Weiter</button>
        </>
      )}

      {step === 6 && (
        <>
          <h2>Datenschutz</h2>
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
          <button onClick={back}>Zurück</button>
          <button disabled={!form.check_datenschutz} onClick={send}>
            Absenden
          </button>
        </>
      )}
    </div>
  );
}
