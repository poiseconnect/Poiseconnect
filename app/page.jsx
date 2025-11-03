"use client";
import { useState } from "react";
import StepIndicator from "./components/StepIndicator";
import { createClient } from "./lib/supabase";

export default function Page() {
  const supabase = createClient();

  const totalSteps = 8;
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
    anschrift: "",
    ort: "",
    strasse: "",
    geburtsdatum: "",
    beschaeftigung: "",
    disclaimer: false,
  });

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function next() {
    if (step < totalSteps - 1) setStep(step + 1);
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  async function handleSubmit() {
    const { error } = await supabase.from("anfragen").insert([form]);
    if (!error) alert("Danke! Deine Anfrage wurde erfolgreich gesendet ✅");
    else alert("Fehler beim Senden ❌");
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
      <h1 style={{ textAlign: "center", color: "#d97f8b" }}>Kontaktformular</h1>

      <StepIndicator currentStep={step} totalSteps={totalSteps} />

      {/* --- STEP 0: Anliegen --- */}
      {step === 0 && (
        <>
          <label>Anliegen *</label>
          <textarea
            value={form.anliegen}
            onChange={(e) => updateField("anliegen", e.target.value)}
            placeholder="Wie können wir dir helfen?"
          />
          <button onClick={next}>Weiter</button>
        </>
      )}

      {/* --- STEP 1: Leidensdruck --- */}
      {step === 1 && (
        <>
          <label>Wie hoch ist dein Leidensdruck von 1-10? *</label>
          <select
            value={form.leidensdruck}
            onChange={(e) => updateField("leidensdruck", e.target.value)}
          >
            <option value="">Bitte auswählen</option>
            {[...Array(10)].map((_, i) => (
              <option key={i + 1}>{i + 1}</option>
            ))}
          </select>

          <button onClick={back}>Zurück</button>
          <button onClick={next}>Weiter</button>
        </>
      )}

      {/* --- STEP 2: Verlauf --- */}
      {step === 2 && (
        <>
          <label>Verlauf *</label>
          <textarea
            value={form.verlauf}
            onChange={(e) => updateField("verlauf", e.target.value)}
            placeholder="Wie lange leidest du schon an deinem Thema?"
          />

          <button onClick={back}>Zurück</button>
          <button onClick={next}>Weiter</button>
        </>
      )}

      {/* --- STEP 3: Ziel --- */}
      {step === 3 && (
        <>
          <label>Ziel *</label>
          <textarea
            value={form.ziel}
            onChange={(e) => updateField("ziel", e.target.value)}
          />

          <button onClick={back}>Zurück</button>
          <button onClick={next}>Weiter</button>
        </>
      )}

      {/* --- STEP 4: Wunschtherapeutin --- */}
      {step === 4 && (
        <>
          <label>Wunschtherapeutin *</label>
          <select
            value={form.wunschtherapeut}
            onChange={(e) => updateField("wunschtherapeut", e.target.value)}
          >
            <option value="">Bitte auswählen</option>
            <option>Linda</option>
            <option>Anna</option>
            <option>Anja</option>
            <option>Babette</option>
          </select>

          <button onClick={back}>Zurück</button>
          <button onClick={next}>Weiter</button>
        </>
      )}

      {/* --- STEP 5: Personendaten --- */}
      {step === 5 && (
        <>
          <label>Vorname *</label>
          <input value={form.vorname} onChange={(e) => updateField("vorname", e.target.value)} />

          <label>Nachname *</label>
          <input value={form.nachname} onChange={(e) => updateField("nachname", e.target.value)} />

          <label>E-Mail *</label>
          <input value={form.email} onChange={(e) => updateField("email", e.target.value)} />

          <label>Anschrift *</label>
          <input value={form.anschrift} onChange={(e) => updateField("anschrift", e.target.value)} />

          <label>Ort *</label>
          <input value={form.ort} onChange={(e) => updateField("ort", e.target.value)} />

          <label>Straße *</label>
          <input value={form.strasse} onChange={(e) => updateField("strasse", e.target.value)} />

          <label>Geburtsdatum *</label>
          <input value={form.geburtsdatum} onChange={(e) => updateField("geburtsdatum", e.target.value)} />

          <button onClick={back}>Zurück</button>
          <button onClick={next}>Weiter</button>
        </>
      )}

      {/* --- STEP 6: Beschäftigung --- */}
      {step === 6 && (
        <>
          <label>Beschäftigungsgrad *</label>
          <select
            value={form.beschaeftigung}
            onChange={(e) => updateField("beschaeftigung", e.target.value)}
          >
            <option>Berufstätig</option>
            <option>Studierend</option>
            <option>Schüler/in</option>
            <option>Arbeitslos</option>
          </select>

          <button onClick={back}>Zurück</button>
          <button onClick={next}>Weiter</button>
        </>
      )}

      {/* --- STEP 7: Disclaimer --- */}
      {step === 7 && (
        <>
          <label>
            <input
              type="checkbox"
              checked={form.disclaimer}
              onChange={(e) => updateField("disclaimer", e.target.checked)}
            />
            Ich habe die Datenschutzerklärung gelesen und akzeptiere sie *
          </label>

          <button onClick={back}>Zurück</button>
          <button onClick={handleSubmit}>Senden</button>
        </>
      )}
    </div>
  );
}
