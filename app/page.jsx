"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import StepIndicator from "./components/StepIndicator";
import TeamCarousel from "./components/TeamCarousel";
import { teamData } from "./teamData";

// --- Red Flag Screening ---
const RED_FLAGS = [
  "suizid", "selbstmord", "selbstverletzung", "ritzen",
  "magersucht", "anorexie", "bulimie", "bulimia", "erbrechen",
  "binge", "binge eating", "essstörung", "essstoerung",
  "borderline", "svv"
];
const isRedFlag = (text) => {
  const t = (text || "").toLowerCase();
  return RED_FLAGS.some((f) => t.includes(f));
};

// --- Kalender (ICS) Links ---
const ICS_BY_MEMBER = {
  Ann: "https://calendar.google.com/calendar/ical/75f62df4c63554a1436d49c3a381da84502728a0457c9c8b56d30e21fa5021c5%40group.calendar.google.com/public/basic.ics",
};

// Format Helpers
const formatDate = (d) =>
  d.toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit" });
const formatTime = (d) =>
  d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });

// ICS Parser
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

// ICS → Slots (30min)
async function loadIcsSlots(icsUrl) {
  const text = await (await fetch(icsUrl + "?v=" + Date.now(), { cache: "no-store" })).text();
  const events = text.split("BEGIN:VEVENT").slice(1);
  const now = new Date();
  const until = new Date(now.getTime() + 21 * 86400000);
  const out = [];

  for (const block of events) {
    const start = parseICSDate((block.match(/DTSTART[^\n]*/)?.[0] || "").trim());
    const end = parseICSDate((block.match(/DTEND[^\n]*/)?.[0] || "").trim());
    if (!start || !end) continue;
    if (end <= now || start > until) continue;

    for (let t = new Date(start); t < end; t = new Date(t.getTime() + 30 * 60000)) {
      const e = new Date(t.getTime() + 30 * 60000);
      if (e <= now || e > end) continue;
      out.push({ start: new Date(t), end: e, key: t.toISOString() });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export default function Home() {
  const [step, setStep] = useState(0);
  const totalSteps = 10;
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
      const score = (m) => m.tags?.filter(t => words.some(w => t.toLowerCase().includes(w))).length || 0;
      return score(b) - score(a);
    });
  }, [form.anliegen]);

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  const send = async () => {
    await fetch("/api/submit", {
      method: "POST",
      body: JSON.stringify(form),
      headers: { "Content-Type": "application/json" },
    });
    alert("Danke — deine Anfrage wurde erfolgreich gesendet.");
    setStep(0);
  };

  // --- Step 9 Kalender Slots ---
  const [slots, setSlots] = useState([]);
  const [selectedDay, setSelectedDay] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (step !== 9) return;
    setForm({ ...form, terminISO: "", terminDisplay: "" });
    setSelectedDay("");
    const load = async () => {
      setLoadingSlots(true);
      const url = ICS_BY_MEMBER[form.wunschtherapeut];
      setSlots(url ? await loadIcsSlots(url) : []);
      setLoadingSlots(false);
    };
    load();
  }, [step]);

  const days = [...new Map(slots.map(s => [s.start.toDateString(), s.start])).entries()]
    .map(([key, start]) => ({ key, date: start }))
    .sort((a, b) => a.date - b.date);

  const daySlots = selectedDay
    ? slots.filter(s => s.start.toDateString() === selectedDay)
    : [];

  return (
    <div className="form-wrapper">
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Image src="/IMG_7599.png" alt="Poise Logo" width={160} height={160} priority />
      </div>
      <StepIndicator step={step} total={totalSteps} />

      {/* ---- STEPS 0–8 UNVERÄNDERT (hier gekürzt, du hast sie bereits) ---- */}

      {/* ---------- STEP 9 MINIKALENDER ---------- */}
      {step === 9 && (
        <div className="step-container">
          <h2>Erstgespräch – Termin wählen</h2>

          {loadingSlots && <p>Kalender wird geladen…</p>}
          {!loadingSlots && days.length === 0 && (
            <p>Keine freien Termine sichtbar.</p>
          )}

          {/* Kalendertage */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, margin: "16px 0" }}>
            {days.map(({ key, date }) => (
              <button
                key={key}
                onClick={() => setSelectedDay(key)}
                style={{
                  padding: "8px 6px",
                  borderRadius: 10,
                  border: selectedDay === key ? "2px solid #A27C77" : "1px solid #ddd",
                  background: selectedDay === key ? "#F3E9E7" : "#fff",
                }}
              >
                {formatDate(date)}
              </button>
            ))}
          </div>

          {/* Time Slots */}
          {selectedDay && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Verfügbare Zeiten</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {daySlots.map((s) => (
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
                      borderRadius: 10,
                      border:
                        form.terminISO === s.start.toISOString()
                          ? "2px solid #A27C77"
                          : "1px solid #ddd",
                      background:
                        form.terminISO === s.start.toISOString()
                          ? "#F3E9E7"
                          : "#fff",
                    }}
                  >
                    {formatTime(s.start)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {form.terminISO && (
            <p style={{ marginTop: 14 }}>Gewählt: <strong>{form.terminDisplay}</strong></p>
          )}

          <div className="footer-buttons" style={{ marginTop: 18 }}>
            <button onClick={back}>Zurück</button>
            <button disabled={!form.terminISO} onClick={send}>Anfrage senden</button>
          </div>
        </div>
      )}
    </div>
  );
}
