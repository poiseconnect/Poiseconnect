"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import StepIndicator from "./components/StepIndicator";
import TeamCarousel from "./components/TeamCarousel";
import { teamData } from "./teamData";

// ---- Ausschlusskriterien ----
const RED_FLAGS = [
  "suizid", "selbstmord", "selbstverletzung", "ritzen",
  "magersucht", "anorexie", "bulim", "erbrechen",
  "binge", "essstörung", "essstoerung",
  "borderline", "svv"
];
const isRedFlag = (t) => t && RED_FLAGS.some(x => t.toLowerCase().includes(x));

// ---- Formatierung ----
const formatDate = (d) =>
  d.toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit" });
const formatTime = (d) =>
  d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });

// ---- ICS -> Slots Parser ----
function parseIcsToSlots(text, daysAhead = 21) {
  const events = text
    .split("BEGIN:VEVENT")
    .slice(1)
    .map((c) => "BEGIN:VEVENT" + c.split("END:VEVENT")[0] + "END:VEVENT");

  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * 86400000);
  const slots = [];

function parseICSDate(line) {
  // Unterstützt:
  // DTSTART:20251110T130000Z
  // DTSTART;TZID=Europe/Vienna:20251110T140000

  const match = line.match(/DTSTART(;TZID=[^:]+)?:([0-9]{8}T[0-9]{4,6})/i)
    || line.match(/DTEND(;TZID=[^:]+)?:([0-9]{8}T[0-9]{4,6})/i);

  if (!match) return null;

  const raw = match[2]; // z.B. "20251110T140000"
  const y = +raw.slice(0, 4);
  const m = +raw.slice(4, 6) - 1;
  const d = +raw.slice(6, 8);
  const hh = +raw.slice(9, 11) || 0;
  const mm = +raw.slice(11, 13) || 0;
  const ss = raw.length >= 15 ? +raw.slice(13, 15) : 0;

  // Wir interpretieren ohne Z als lokale Zeit (Europe/Vienna)
  return new Date(y, m, d, hh, mm, ss);
}

  for (const ev of events) {
    const sLine = ev.split("\n").find((l) => l.startsWith("DTSTART"));
    const eLine = ev.split("\n").find((l) => l.startsWith("DTEND"));
    if (!sLine || !eLine) continue;

    const start = parseICSDate(sLine.trim());
    const end = parseICSDate(eLine.trim());
    if (!start || !end || end <= now || start > until) continue;

    for (let t = new Date(start); t < end; t = new Date(t.getTime() + 30 * 60000)) {
      const tEnd = new Date(t.getTime() + 30 * 60000);
      if (tEnd <= now || tEnd > end) continue;
      slots.push({ start: new Date(t), end: tEnd, key: t.toISOString() });
    }
  }

  return slots.sort((a, b) => a.start - b.start);
}

// ---- Slots vom Proxy laden (CORS-Fix) ----
async function loadSlotsViaProxy(member, daysAhead = 21) {
  const r = await fetch(`/api/ics?member=${encodeURIComponent(member)}`, { cache: "no-store" });
  if (!r.ok) throw new Error("ICS fetch failed");
  const text = await r.text();
  return parseIcsToSlots(text, daysAhead);
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
      const score = (m) =>
        m.tags?.filter((tag) => words.some((w) => tag.toLowerCase().includes(w))).length || 0;
      return score(b) - score(a);
    });
  }, [form.anliegen]);

  const isAdult = (d) => {
    const birth = new Date(d);
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
    } else alert("Fehler — bitte versuche es erneut.");
  };

  // ---- Termin-Slots laden ----
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  useEffect(() => {
    if (step !== 9) return;
    (async () => {
      setLoadingSlots(true);
      setSlotsError("");
      try {
        if (!form.wunschtherapeut) {
          setSlotsError("Bitte zuerst im Schritt 5 eine Begleitung auswählen.");
        } else {
          const s = await loadSlotsViaProxy(form.wunschtherapeut, 21);
          setSlots(s);
        }
      } catch {
        setSlotsError("Kalender konnte nicht geladen werden.");
      }
      setLoadingSlots(false);
    })();
  }, [step, form.wunschtherapeut]);

  const groupedSlots = useMemo(() => {
    const m = new Map();
    slots.forEach((s) => {
      const k = s.start.toDateString();
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(s);
    });
    return [...m.entries()];
  }, [slots]);

  return (
    <div className="form-wrapper">
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <Image src="/IMG_7599.png" width={160} height={160} alt="Poise Logo" priority />
      </div>

      <StepIndicator step={step} total={totalSteps} />

      {/* STEP 0 */}
      {step === 0 && (
        <div className="step-container">
          <h2>Anliegen</h2>
          <textarea value={form.anliegen} onChange={(e) => setForm({ ...form, anliegen: e.target.value })} />
          <div className="footer-buttons"><span /><button disabled={!form.anliegen} onClick={next}>Weiter</button></div>
        </div>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <div className="step-container">
          <h2>Wie hoch ist dein Leidensdruck?</h2>
          <select value={form.leidensdruck} onChange={(e) => setForm({ ...form, leidensdruck: e.target.value })}>
            <option value="">Bitte auswählen…</option><option>niedrig</option><option>mittel</option><option>hoch</option><option>sehr hoch</option>
          </select>
          <div className="footer-buttons"><button onClick={back}>Zurück</button><button disabled={!form.leidensdruck} onClick={next}>Weiter</button></div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="step-container">
          <h2>Wie lange leidest du schon?</h2>
          <textarea value={form.verlauf} onChange={(e) => setForm({ ...form, verlauf: e.target.value })} />
          <div className="footer-buttons"><button onClick={back}>Zurück</button><button disabled={!form.verlauf} onClick={next}>Weiter</button></div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="step-container">
          <h2>Gibt es eine Diagnose?</h2>
          <select value={form.diagnose} onChange={(e) => setForm({ ...form, diagnose: e.target.value })}>
            <option value="">Bitte auswählen…</option><option>Ja</option><option>Nein</option>
          </select>
          <div className="footer-buttons"><button onClick={back}>Zurück</button><button disabled={!form.diagnose} onClick={next}>Weiter</button></div>
        </div>
      )}

      {/* STEP 4 */}
      {step === 4 && (
        <div className="step-container">
          <h2>Was wünschst du dir?</h2>
          <textarea value={form.ziel} onChange={(e) => setForm({ ...form, ziel: e.target.value })} />
          <div className="footer-buttons"><button onClick={back}>Zurück</button><button disabled={!form.ziel} onClick={next}>Weiter</button></div>
        </div>
      )}

      {/* STEP 5 Matching + Red-Flag */}
      {step === 5 && (
        <div className="step-container">
          {isRedFlag(form.anliegen) ? (
            <>
              <h2>Vielen Dank für deine Offenheit</h2>
              <p style={{ whiteSpace: "pre-line" }}>
{`Vielen Dank für deine Anfrage! Erst einmal freut es uns, dass du dir vorstellen könntest mit uns zu arbeiten :) ... (Absagetext unverändert hier) ...`}
              </p>
              <div className="footer-buttons"><button onClick={back}>Zurück</button><button onClick={next}>Weiter</button></div>
            </>
          ) : (
            <>
              <h2>Wer könnte gut zu dir passen?</h2>
              <TeamCarousel members={sortedTeam} onSelect={(name) => { setForm({ ...form, wunschtherapeut: name }); next(); }} />
              <div className="footer-buttons"><button onClick={back}>Zurück</button></div>
            </>
          )}
        </div>
      )}

      {/* STEP 6 */}
      {step === 6 && (
        <div className="step-container">
          <h2>Kontaktdaten</h2>
          <input placeholder="Vorname" value={form.vorname} onChange={(e) => setForm({ ...form, vorname: e.target.value })} />
          <input placeholder="Nachname" value={form.nachname} onChange={(e) => setForm({ ...form, nachname: e.target.value })} />
          <input placeholder="E-Mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Adresse" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          <input type="date" value={form.geburtsdatum} onChange={(e) => setForm({ ...form, geburtsdatum: e.target.value })} />
          {form.geburtsdatum && !isAdult(form.geburtsdatum) && <p style={{ color: "red" }}>Du musst mindestens 18 Jahre alt sein.</p>}
          <div className="footer-buttons"><button onClick={back}>Zurück</button><button disabled={!form.vorname || !form.nachname || !form.email || !form.adresse || !form.geburtsdatum || !isAdult(form.geburtsdatum)} onClick={next}>Weiter</button></div>
        </div>
      )}

      {/* STEP 7 */}
      {step === 7 && (
        <div className="step-container">
          <h2>Beschäftigungsgrad</h2>
          <select value={form.beschaeftigungsgrad} onChange={(e) => setForm({ ...form, beschaeftigungsgrad: e.target.value })}>
            <option value="">Bitte auswählen…</option>
            <option>Angestellt</option><option>Selbstständig</option><option>Arbeitssuchend</option><option>Schule/Studium</option>
          </select>
          <div className="footer-buttons"><button onClick={back}>Zurück</button><button disabled={!form.beschaeftigungsgrad} onClick={next}>Weiter</button></div>
        </div>
      )}

      {/* STEP 8 */}
      {step === 8 && (
        <div className="step-container">
          <h2>Wichtige Hinweise</h2>

          <label className="checkbox">
            <input type="checkbox" checked={form.check_datenschutz} onChange={() => setForm({ ...form, check_datenschutz: !form.check_datenschutz })} />
            Ich akzeptiere die Datenschutzerklärung.
          </label>

          <label className="checkbox">
            <input type="checkbox" checked={form.check_online_setting} onChange={() => setForm({ ...form, check_online_setting: !form.check_online_setting })} />
            Ich bestätige ein geeignetes Gerät & ruhige Umgebung.
          </label>

          <label className="checkbox">
            <input type="checkbox" checked={form.check_gesundheit} onChange={() => setForm({ ...form, check_gesundheit: !form.check_gesundheit })} />
            Ich leide nicht unter suizidalen Gedanken / SVV / Essstörung.
          </label>

          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button disabled={!form.check_datenschutz || !form.check_online_setting || !form.check_gesundheit} onClick={next}>
              Weiter
            </button>
          </div>
        </div>
      )}

      {/* STEP 9 MINI-KALENDER */}
        {step === 9 && (
        <div className="step-container">
          <h2>Erstgespräch – Termin wählen</h2>

          {loadingSlots && <p>Kalender wird geladen…</p>}
          {slotsError && <p style={{ color: "red" }}>{slotsError}</p>}
          {!loadingSlots && groupedSlots.length === 0 && <p>Keine freien Termine verfügbar.</p>}

          {!loadingSlots && groupedSlots.length > 0 && groupedSlots.map(([day, list]) => (
            <div key={day} style={{ marginBottom: 14 }}>
              <strong>{formatDate(list[0].start)}</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                {list.map((s) => (
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
                      padding: "6px 10px",
                      borderRadius: 10,
                      border: form.terminISO === s.start.toISOString()
                        ? "2px solid #A27C77"
                        : "1px solid #ddd",
                      background: form.terminISO === s.start.toISOString()
                        ? "#F3E9E7"
                        : "#fff",
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
            <button onClick={back}>Zurück</button>
            <button disabled={!form.terminISO} onClick={send}>Anfrage senden</button>
          </div>
        </div>
      )}
    </div>
  );
}
