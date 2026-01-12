"use client";

import { useState, useMemo } from "react";
import StepIndicator from "./components/StepIndicator";
import { teamData } from "./lib/teamData";

const TOTAL_STEPS = 12;

export default function Page() {
  const [step, setStep] = useState(0);

  const [form, setForm] = useState({
    anliegen: "",
    leidensdruck: "",
    verlauf: "",
    ziel: "",

    // optionale Vertiefung
    schlaf: "",
    bewegung: "",
    stresslevel: "",
    substanzen: "",
    sonstiges: "",

    vorname: "",
    nachname: "",
    email: "",
    telefon: "",

    wunschtherapeut: "",
    terminDisplay: "",
    terminISO: "",
  });

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  /* ---------------- ZUSAMMENFASSUNG ---------------- */
  const summary = useMemo(
    () => [
      ["Anliegen", form.anliegen],
      ["Leidensdruck", form.leidensdruck],
      ["Verlauf", form.verlauf],
      ["Ziel", form.ziel],
      ["Schlaf", form.schlaf],
      ["Bewegung", form.bewegung],
      ["Stress", form.stresslevel],
      ["Substanzen", form.substanzen],
      ["Sonstiges", form.sonstiges],
      ["Name", `${form.vorname} ${form.nachname}`],
      ["E-Mail", form.email],
      ["Telefon", form.telefon],
      ["Therapeut:in", form.wunschtherapeut],
      ["Termin", form.terminDisplay],
    ],
    [form]
  );

  /* ---------------- SEND ---------------- */
  async function send() {
    await fetch("/api/form-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    alert(
      "Danke! Deine Anfrage wurde gesendet.\n\nDer Termin ist ANGEFRAGT und wird noch vom Teammitglied bestätigt."
    );
  }

  return (
    <div className="form-wrapper">
      <StepIndicator step={step} total={TOTAL_STEPS} />

      {/* STEP 0 */}
      {step === 0 && (
        <>
          <h2>Worum geht es?</h2>
          <textarea
            value={form.anliegen}
            onChange={(e) => setForm({ ...form, anliegen: e.target.value })}
          />
          <button disabled={!form.anliegen} onClick={next}>
            Weiter
          </button>
        </>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <>
          <h2>Leidensdruck</h2>
          <select
            value={form.leidensdruck}
            onChange={(e) =>
              setForm({ ...form, leidensdruck: e.target.value })
            }
          >
            <option value="">Bitte wählen</option>
            <option>niedrig</option>
            <option>mittel</option>
            <option>hoch</option>
            <option>sehr hoch</option>
          </select>
          <button onClick={back}>Zurück</button>
          <button disabled={!form.leidensdruck} onClick={next}>
            Weiter
          </button>
        </>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <>
          <h2>Wie lange schon?</h2>
          <textarea
            value={form.verlauf}
            onChange={(e) => setForm({ ...form, verlauf: e.target.value })}
          />
          <button onClick={back}>Zurück</button>
          <button disabled={!form.verlauf} onClick={next}>
            Weiter
          </button>
        </>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <>
          <h2>Was wünschst du dir?</h2>
          <textarea
            value={form.ziel}
            onChange={(e) => setForm({ ...form, ziel: e.target.value })}
          />
          <button onClick={back}>Zurück</button>
          <button disabled={!form.ziel} onClick={next}>
            Weiter
          </button>
        </>
      )}

      {/* STEP 4 – OPTIONAL */}
      {step === 4 && (
        <>
          <h2>Optional – zur besseren Einschätzung</h2>

          <label>Schlaf</label>
          <textarea
            value={form.schlaf}
            onChange={(e) => setForm({ ...form, schlaf: e.target.value })}
          />

          <label>Bewegung</label>
          <textarea
            value={form.bewegung}
            onChange={(e) => setForm({ ...form, bewegung: e.target.value })}
          />

          <label>Stresslevel</label>
          <textarea
            value={form.stresslevel}
            onChange={(e) =>
              setForm({ ...form, stresslevel: e.target.value })
            }
          />

          <label>Substanzen</label>
          <textarea
            value={form.substanzen}
            onChange={(e) =>
              setForm({ ...form, substanzen: e.target.value })
            }
          />

          <button onClick={back}>Zurück</button>
          <button onClick={next}>Weiter</button>
        </>
      )}

      {/* STEP 10 – ZUSAMMENFASSUNG */}
      {step === 10 && (
        <>
          <h2>Zusammenfassung</h2>

          <ul>
            {summary.map(
              ([label, value]) =>
                value && (
                  <li key={label}>
                    <strong>{label}:</strong> {value}
                  </li>
                )
            )}
          </ul>

          <p style={{ marginTop: 16 }}>
            ℹ️ Der Termin ist <strong>angefragt</strong> und wird noch vom
            Teammitglied bestätigt.
          </p>

          <button onClick={back}>Zurück</button>
          <button onClick={send}>Anfrage senden</button>
        </>
      )}
    </div>
  );
}
