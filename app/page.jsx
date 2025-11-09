"use client";

import { useState } from "react";
import Image from "next/image";

import StepIndicator from "./components/StepIndicator";
import TeamCarousel from "./components/TeamCarousel";
import { teamData } from "./teamData";

const RED_FLAGS = [
  "suizid", "selbstmord", "selbstverletzung", "ritzen",
  "magersucht", "anorexie", "bulimie", "bulimia", "erbrechen",
  "binge", "binge eating", "essstörung", "essstoerung",
  "borderline", "svv"
];

const isRedFlag = (text) => {
  if (!text) return false;
  const t = text.toLowerCase();
  return RED_FLAGS.some(flag => t.includes(flag));
};

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

    // ✅ NEU & notwendig für Step 8
    check_datenschutz: false,
    check_online_setting: false,
    check_gesundheit: false
  });

  const [activeIndex, setActiveIndex] = useState(0);

  // ---------- Matching ----------
  const getSortedTeam = () => {
    if (!form.anliegen) return teamData || [];
    const keywords = form.anliegen.toLowerCase().split(/[\s,.;!?]+/).filter(Boolean);

    return [...(teamData || [])].sort((a, b) => {
      const score = (member) =>
        member.tags?.filter((tag) =>
          keywords.some((word) => tag.toLowerCase().includes(word))
        ).length || 0;

      return score(b) - score(a);
    });
  };

  const sortedTeam = getSortedTeam();

  // ---------- Alterscheck ----------
  const isAdult = (dateString) => {
    const birth = new Date(dateString);
    const age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    return age > 18 || (age === 18 && m >= 0);
  };

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  // ---------- SEND ----------
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
        <Image src="/IMG_7599.png" alt="Poise Logo" width={160} height={160} priority />
      </div>

      <StepIndicator step={step} total={totalSteps} />

      {/* STEP 0 */}
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
            <button disabled={!form.leidensdruck} onClick={next}>Weiter</button>
          </div>
        </div>
      )}

      {/* STEP 2 */}
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

      {/* STEP 3 */}
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

      {/* STEP 4 */}
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

      {/* STEP 5 Matching & Screening */}
      {step === 5 && (
        <div className="step-container">
          {isRedFlag(form.anliegen) ? (
            <>
              <h2>Vielen Dank für deine Offenheit</h2>

              <p style={{ whiteSpace: "pre-line", lineHeight: 1.55 }}>
{`Vielen Dank für deine Anfrage! Erst einmal freut es uns, dass du dir vorstellen könntest mit uns zu arbeiten :) Das ist ein schönes Kompliment. Danke für dein Vertrauen und deine Offenheit.

Leider begleiten wir dein Thema nicht im Online-Setting...
(Absage-Text bleibt wie bei dir im Code)
`}
              </p>

              <div className="footer-buttons">
                <button onClick={back}>Zurück</button>
                <button onClick={next}>Weiter</button>
              </div>
            </>
          ) : (
            <>
              <h2>Wer könnte gut zu dir passen?</h2>
              <TeamCarousel
                members={sortedTeam}
                onSelect={(name) => {
                  setForm({ ...form, wunschtherapeut: name });
                  next();
                }}
              />
              <div className="footer-buttons">
                <button onClick={back}>Zurück</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 6 */}
      {step === 6 && (
        <div className="step-container">
          <h2>Kontaktdaten</h2>

          <input
            placeholder="Vorname"
            value={form.vorname}
            onChange={(e) => setForm({ ...form, vorname: e.target.value })}
          />

          <input
            placeholder="Nachname"
            value={form.nachname}
            onChange={(e) => setForm({ ...form, nachname: e.target.value })}
          />

          <input
            type="email"
            placeholder="E-Mail"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <input
            placeholder="Adresse"
            value={form.adresse}
            onChange={(e) => setForm({ ...form, adresse: e.target.value })}
          />

          <input
            type="date"
            value={form.geburtsdatum}
            onChange={(e) => setForm({ ...form, geburtsdatum: e.target.value })}
          />

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

      {/* STEP 8 - Bedingungen */}
      {step === 8 && (
        <div className="step-container">
          <h2>Wichtige Hinweise</h2>

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

          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.check_online_setting}
              onChange={() =>
                setForm({ ...form, check_online_setting: !form.check_online_setting })
              }
            />
            Ich habe Kamera & Mikrofon und sorge für eine ruhige Umgebung.
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.check_gesundheit}
              onChange={() =>
                setForm({ ...form, check_gesundheit: !form.check_gesundheit })
              }
            />
            Ich bestätige, dass keine Suizid-, Sucht- oder Essstörungsproblematik besteht.
          </label>

          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button
              disabled={
                !form.check_datenschutz ||
                !form.check_online_setting ||
                !form.check_gesundheit
              }
              onClick={send}
            >
              Anfrage senden
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
