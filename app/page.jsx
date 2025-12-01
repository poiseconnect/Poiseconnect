"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import StepIndicator from "./components/StepIndicator";
import TeamCarousel from "./components/TeamCarousel";
import { teamData } from "./teamData";
import { supabase } from "./lib/supabase";

// ----------------------
// FORMAT HELPERS
// ----------------------
const formatDate = (d) =>
  d.toLocaleDateString("de-AT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

const formatTime = (d) =>
  d.toLocaleTimeString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
  });

// ----------------------
// ICS PARSER
// ----------------------
function parseICSDate(line) {
  const m = line.match(/DT(?:START|END)(?:;TZID=[^:]+)?:([0-9T]+)/i);
  if (!m) return null;

  const raw = m[1];
  return new Date(
    Number(raw.slice(0, 4)),
    Number(raw.slice(4, 6)) - 1,
    Number(raw.slice(6, 8)),
    Number(raw.slice(9, 11)) || 0,
    Number(raw.slice(11, 13)) || 0
  );
}

async function loadIcsSlots(icsUrl, daysAhead = 21) {
  const res = await fetch(`/api/ics?url=${encodeURIComponent(icsUrl)}`);
  const text = await res.text();

  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * 86400000);

  const events = text.split("BEGIN:VEVENT").slice(1);
  const slots = [];

  for (const ev of events) {
    const startLine = ev.split("\n").find((l) => l.startsWith("DTSTART"));
    const endLine = ev.split("\n").find((l) => l.startsWith("DTEND"));
    if (!startLine || !endLine) continue;

    const start = parseICSDate(startLine);
    const end = parseICSDate(endLine);
    if (!start || !end || end <= now || start > until) continue;

    let t = new Date(start);
    while (t < end) {
      const tEnd = new Date(t.getTime() + 1800000);
      if (tEnd > end || tEnd <= now) break;

      slots.push({ start: new Date(t) });
      t = new Date(t.getTime() + 1800000);
    }
  }

  return slots.sort((a, b) => a.start - b.start);
}

// --------------------------------------------------
// 🔥 PAGE COMPONENT
// --------------------------------------------------
export default function Home() {
  const today = new Date();
  const [step, setStep] = useState(0);
  const [subStep9, setSubStep9] = useState(0);

  // Alle Formular-Daten + Termin
  const [form, setForm] = useState({
    anliegen: "",
    verlauf: "",
    diagnose: "",
    ziel: "",
    wunschtherapeut: "",
    vorname: "",
    nachname: "",
    email: "",
    telefon: "",
    adresse: "",
    geburtsdatum: "",
    beschaeftigungsgrad: "",
    check_datenschutz: false,
    check_online_setting: false,
    check_gesundheit: false,
    terminISO: "",
    terminDisplay: "",
  });

  // Termine
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [bookedIso, setBookedIso] = useState([]);

  // --------------------------
  // 🔁 REDIRECT HANDLING
  // --------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const resume = params.get("resume");
    const email = params.get("email") || "";
    const therapist = params.get("therapist") || "";

    if (!resume) return;

    // Termin bestätigt
    if (resume === "confirmed") {
      alert("Der Termin wurde bestätigt 🤍");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    // Neuer Termin gleicher Therapeut
    if (resume === "10") {
      setForm((f) => ({
        ...f,
        email,
        wunschtherapeut: therapist || f.wunschtherapeut,
        terminISO: "",
        terminDisplay: "",
      }));
      setStep(10);
    }

    // Neues Teammitglied
    if (resume === "5") {
      setForm((f) => ({
        ...f,
        email,
        wunschtherapeut: "",
        terminISO: "",
        terminDisplay: "",
      }));
      setStep(5);
    }

    // URL bereinigen
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  // --------------------------
  // 🔥 STEP 10 – SLOT LADEN
  // --------------------------
  useEffect(() => {
    if (step !== 10 || !form.wunschtherapeut) return;
    let active = true;

    async function loadSlots() {
      setLoadingSlots(true);
      setSlotsError("");

      const therapistObj = teamData.find(
        (t) => t.name === form.wunschtherapeut
      );

      if (!therapistObj || !therapistObj.ics) {
        setSlotsError("Kein Kalender hinterlegt.");
        setLoadingSlots(false);
        return;
      }

      // ICS Slots laden
      const allSlots = await loadIcsSlots(therapistObj.ics);

      // Bereits bestätigte Termine aus Supabase
      const { data } = await supabase
        .from("booked_appointments")
        .select("termin_iso")
        .eq("therapist", form.wunschtherapeut);

      const confirmed = new Set((data || []).map((r) => r.termin_iso));

      const free = allSlots.filter(
        (s) => !confirmed.has(s.start.toISOString())
      );

      if (active) {
        setSlots(free);
        setBookedIso([...confirmed]);
      }

      setLoadingSlots(false);
    }

    loadSlots();
    return () => (active = false);
  }, [step, form.wunschtherapeut]);

  // Gruppieren der Slots nach Tag
  const grouped = useMemo(() => {
    const map = new Map();

    for (const s of slots) {
      const iso = s.start.toISOString();
      if (bookedIso.includes(iso)) continue;

      const key = s.start.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }

    return Array.from(map.entries());
  }, [slots, bookedIso]);

  // --------------------------
  // API SEND (Step 10 → form-submit)
  // --------------------------
  const send = async () => {
    const res = await fetch("/api/form-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      alert("Fehler – Anfrage konnte nicht gesendet werden.");
      return;
    }

    alert("Danke – deine Anfrage wurde erfolgreich gesendet 🤍");
  };

  // --------------------------
  // RENDERING (Schritte 0–10)
  // --------------------------
  const totalSteps = 11;

  return (
    <div className="form-wrapper">
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Image
          src="/IMG_7599.png"
          width={160}
          height={160}
          alt="Poise Logo"
          priority
        />
      </div>

      <StepIndicator step={step} total={totalSteps} />

      {/* --- STEP 0 Anliegen --- */}
      {step === 0 && (
        <div className="step-container">
          <h2>Anliegen</h2>
          <textarea
            value={form.anliegen}
            onChange={(e) =>
              setForm({ ...form, anliegen: e.target.value })
            }
          />
          <div className="footer-buttons">
            <span />
            <button
              disabled={!form.anliegen}
              onClick={() => setStep(1)}
            >
              Weiter
            </button>
          </div>
        </div>
      )}

      {/* ... ALLE STEPS 1–9 UNVERÄNDERT ... */}

      {/* --- STEP 10 Terminwahl --- */}
      {step === 10 && (
        <div className="step-container">
          <h2>Erstgespräch – Termin wählen</h2>

          {loadingSlots && <p>Kalender wird geladen…</p>}
          {slotsError && <p style={{ color: "red" }}>{slotsError}</p>}

          {!loadingSlots &&
            grouped.map(([day, list]) => (
              <div key={day} style={{ marginBottom: 14 }}>
                <strong>{formatDate(list[0].start)}</strong>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 6,
                  }}
                >
                  {list.map((s) => (
                    <button
                      key={s.start.toISOString()}
                      onClick={() =>
                        setForm({
                          ...form,
                          terminISO: s.start.toISOString(),
                          terminDisplay: `${formatDate(
                            s.start
                          )} ${formatTime(s.start)}`,
                        })
                      }
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
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

          {form.terminISO && (
            <p style={{ marginTop: 12 }}>
              Gewählt: <strong>{form.terminDisplay}</strong>
            </p>
          )}

          <div className="footer-buttons" style={{ marginTop: 16 }}>
            <button onClick={() => setStep(9)}>Zurück</button>
            <button disabled={!form.terminISO} onClick={send}>
              Anfrage senden
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
