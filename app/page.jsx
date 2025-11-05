"use client";

import { useState } from "react";
import Image from "next/image";

import StepIndicator from "./components/StepIndicator";
import TeamCarousel from "./components/TeamCarousel";
import TeamDetail from "./components/TeamDetail";
import { teamData } from "./teamData";

export default function Home() {
  const [step, setStep] = useState(0);
  const totalSteps = 9;
  const today = new Date();

  const [activeIndex, setActiveIndex] = useState(0);

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

  // --- Altersprüfung ---
  const isAdult = (dateString) => {
    const birth = new Date(dateString);
    const age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    return age > 18 || (age === 18 && m >= 0);
  };

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  // --- Formular senden ---
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

  // --- Matching basierend auf Anliegen ---
  const getSortedTeam = () => {
    if (!form.anliegen) return teamData; // keine Eingabe → original Reihenfolge

    const keywords = form.anliegen.toLowerCase().split(/[\s,.;!?]+/);

    return [...teamData].sort((a, b) => {
      const aScore =
        a.tags?.filter((tag) =>
          keywords.some((word) => tag.toLowerCase().includes(word))
        ).length || 0;

      const bScore =
        b.tags?.filter((tag) =>
          keywords.some((word) => tag.toLowerCase().includes(word))
        ).length || 0;

      return bScore - aScore;
    });
  };

  const sortedTeam = getSortedTeam();

  return (
    <div className="form-wrapper">
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <Image
          src="/IMG_7599.png"
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
            placeholder="z. B. seit 3 Jahren, seit der Kindheit…"
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
          <h2>Was wünschst du dir?</h2>
          <textarea
            placeholder="Was möchtest du verändern?"
            value={form.ziel}
            onChange={(e) => setForm({ ...form, ziel: e.target.value })}
          />
          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button disabled={!form.ziel} onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* ---------- STEP 5 Matching ---------- */}
      {step === 5 && (
        <div className="step-container">
          <h2>Wer könnte gut zu dir passen?</h2>

          <TeamCarousel
            members={sortedTeam}
            activeIndex={activeIndex}
            setActiveIndex={setActiveIndex}
          />

          <TeamDetail
            member={sortedTeam[activeIndex]}
            onSelect={(name) => {
              setForm({ ...form, wunschtherapeut: name });
              next();
            }}
          />

          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
          </div>
        </div>
      )}

      {/* ---------- STEP 6+ bleiben unverändert ---------- */}
      {/* (dein bisheriger Code für Kontaktdaten, Beschäftigung, Datenschutz bleibt wie er ist) */}
    </div>
  );
}
