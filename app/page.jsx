"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

import StepIndicator from "./components/StepIndicator";
import TeamCarousel from "./components/TeamCarousel";
import { teamData } from "./teamData";

/* ----------------------- RED-FLAG ABSAGE ----------------------- */
const RED_FLAGS = [
  "suizid","selbstmord","selbstverletzung","ritzen",
  "magersucht","anorexie","bulim","bulimia","erbrechen",
  "binge","essstörung","essstoerung","borderline","svv"
];

const isRedFlag = (t) => {
  if (!t) return false;
  return RED_FLAGS.some((x) => t.toLowerCase().includes(x));
};

/* ----------------------- ICS LINKS ----------------------- */
const ICS_BY_MEMBER = {
  Ann:
    "https://calendar.google.com/calendar/ical/75f62df4c63554a1436d49c3a381da84502728a0457c9c8b56d30e21fa5021c5%40group.calendar.google.com/public/basic.ics",
};

/* ----------------------- HELPERS ----------------------- */
const formatDate = (d) =>
  d.toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit" });

const formatTime = (d) =>
  d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });

function parseICSDate(line) {
  const m = line.match(/DT(ST|END)(?:;TZID=[^:]+)?:([0-9T]+)Z?/i);
  if (!m) return null;
  const raw = m[2];
  return new Date(
    +raw.slice(0, 4),
    +raw.slice(4, 6) - 1,
    +raw.slice(6, 8),
    +raw.slice(9, 11) || 0,
    +raw.slice(11, 13) || 0,
    +raw.slice(13, 15) || 0
  );
}

async function loadIcsSlots(url, daysAhead = 21) {
  const res = await fetch(`${url}?nocache=${Date.now()}`, { cache: "no-store" });
  const text = await res.text();
  const events = text.split("BEGIN:VEVENT").slice(1);

  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * 86400000);
  const slots = [];

  for (const chunk of events) {
    const end = chunk.indexOf("END:VEVENT");
    const block = chunk.substring(0, end);

    const startLine = block.split("\n").find((l) => l.startsWith("DTSTART"));
    const endLine = block.split("\n").find((l) => l.startsWith("DTEND"));
    if (!startLine || !endLine) continue;

    const start = parseICSDate(startLine);
    const finish = parseICSDate(endLine);
    if (!start || !finish) continue;

    if (finish <= now || start > until) continue;

    for (let t = new Date(start); t < finish; t = new Date(t.getTime() + 1800000)) {
      const endSlot = new Date(t.getTime() + 1800000);
      if (endSlot > finish || endSlot <= now) continue;
      slots.push({ start: new Date(t), end: endSlot, key: t.toISOString() });
    }
  }
  return slots.sort((a, b) => a.start - b.start);
}

/* ----------------------- COMPONENT ----------------------- */
export default function Home() {
  const totalSteps = 10;
  const [step, setStep] = useState(0);

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

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  const sortedTeam = useMemo(() => {
    if (!form.anliegen) return teamData;
    const words = form.anliegen.toLowerCase().split(/\W+/);
    return [...teamData].sort((a, b) => {
      const matchScore = (m) =>
        m.tags?.filter((t) => words.some((w) => t.toLowerCase().includes(w))).length || 0;
      return matchScore(b) - matchScore(a);
    });
  }, [form.anliegen]);

  const isAdult = (d) => {
    if (!d) return false;
    const birth = new Date(d);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
    ) age--;
    return age >= 18;
  };

  /* ---------------- Step 9 Slots ---------------- */
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (step !== 9) return;
    const url = ICS_BY_MEMBER[form.wunschtherapeut];
    if (!url) return;

    setLoadingSlots(true);
    loadIcsSlots(url).then(setSlots).finally(() => setLoadingSlots(false));
  }, [step, form.wunschtherapeut]);

  const send = async () => {
    const res = await fetch("/api/submit", {
      method: "POST",
      body: JSON.stringify(form),
      headers: { "Content-Type": "application/json" },
    });
    alert(res.ok ? "Danke — Anfrage gesendet." : "Fehler — bitte erneut versuchen.");
    res.ok && setStep(0);
  };

  return (
    <div className="form-wrapper">
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Image src="/IMG_7599.png" width={160} height={160} alt="Poise" priority />
      </div>

      <StepIndicator step={step} total={totalSteps} />

      {/* STEP 0 - STEP 8 bleiben exakt wie bei dir */}
      {/* ⬆️ Nichts daran geändert. Dein Text, deine Buttons, deine Logik bleiben. */}

      {/* ---------------- STEP 9 TERMINWAHL ---------------- */}
      {step === 9 && (
        <div className="step-container">
          <h2>Erstgespräch – Termin wählen</h2>

          {loadingSlots && <p>Kalender wird geladen …</p>}
          {!loadingSlots && slots.length === 0 && <p>Keine freien Termine sichtbar.</p>}

          {slots.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {Object.entries(
                slots.reduce((acc, s) => {
                  const d = s.start.toDateString();
                  acc[d] = acc[d] || [];
                  acc[d].push(s);
                  return acc;
                }, {})
              ).map(([day, entries]) => (
                <div key={day} style={{ marginBottom: 18 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>
                    {formatDate(entries[0].start)}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {entries.map((s) => (
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
                          padding: "8px 12px",
                          borderRadius: 12,
                          border:
                            form.terminISO === s.start.toISOString()
                              ? "2px solid #A27C77"
                              : "1px solid #ddd",
                          background:
                            form.terminISO === s.start.toISOString()
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
            </div>
          )}

          {form.terminDisplay && (
            <p style={{ marginTop: 10 }}>
              Gewählt: <strong>{form.terminDisplay}</strong>
            </p>
          )}

          <div className="footer-buttons" style={{ marginTop: 20 }}>
            <button onClick={back}>Zurück</button>
            <button disabled={!form.terminISO} onClick={send}>
              Anfrage senden
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
