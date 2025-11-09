"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

import StepIndicator from "./components/StepIndicator";
import TeamCarousel from "./components/TeamCarousel";
import { teamData } from "./teamData";

// ---- Red-Flag-Erkennung (Absagefälle) ----
const RED_FLAGS = [
  "suizid", "selbstmord", "selbstverletzung", "ritzen",
  "magersucht", "anorexie", "bulimie", "bulimia", "erbrechen",
  "binge", "binge eating", "essstörung", "essstoerung",
  "borderline", "svv"
];
const isRedFlag = (text) => {
  if (!text) return false;
  const t = String(text || "").toLowerCase();
  return RED_FLAGS.some((f) => t.includes(f));
};

// ---- ICS-Links je Teammitglied (zellweise erweiterbar) ----
// Für alle weiteren Mitglieder einfach ergänzen:
const ICS_BY_MEMBER = {
  Ann:
    "https://calendar.google.com/calendar/ical/75f62df4c63554a1436d49c3a381da84502728a0457c9c8b56d30e21fa5021c5%40group.calendar.google.com/public/basic.ics",
  // Anna: "https://calendar.google.com/calendar/ical/.../basic.ics",
  // ...
};

// Utility: Datum hübsch
const formatDate = (d) =>
  d.toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit" });

const formatTime = (d) =>
  d.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });

// ICS-Datum parsen (unterstützt DTSTART:YYYYMMDDTHHMMSSZ und DTSTART;TZID=...:YYYYMMDDTHHMMSS)
function parseICSDate(line) {
  // Beispiele:
  // DTSTART:20251110T130000Z
  // DTSTART;TZID=Europe/Vienna:20251110T140000
  const m = line.match(/DT(ST|END)(?:;TZID=[^:]+)?:([0-9T]+)Z?/i);
  if (!m) return null;
  const raw = m[2]; // 20251110T140000
  const y = +raw.slice(0, 4);
  const mo = +raw.slice(4, 6) - 1;
  const d = +raw.slice(6, 8);
  const hh = +raw.slice(9, 11) || 0;
  const mm = +raw.slice(11, 13) || 0;
  const ss = +raw.slice(13, 15) || 0;
  // Wir interpretieren ohne Z als lokale Zeit (Europe/Vienna via Browser)
  return new Date(y, mo, d, hh, mm, ss);
}

// ICS in 30-Minuten Slots verwandeln (nächste 21 Tage)
async function loadIcsSlots(icsUrl, daysAhead = 21) {
  const res = await fetch(`${icsUrl}?nocache=${Date.now()}`, { cache: "no-store" });
  const text = await res.text();

  // VEVENT-Blöcke trennen
  const events = text
    .split("BEGIN:VEVENT")
    .slice(1)
    .map((chunk) => "BEGIN:VEVENT" + chunk.split("END:VEVENT")[0] + "END:VEVENT");

  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  // Jede Verfügbarkeits-„Belegt“-Periode (im Freigabe-Kalender sind das deine Freifenster) in 30-Min-Slots splitten
  const slots = [];
  for (const ev of events) {
    const dtstartLine = ev.split("\n").find((l) => l.startsWith("DTSTART"));
    const dtendLine = ev.split("\n").find((l) => l.startsWith("DTEND"));
    if (!dtstartLine || !dtendLine) continue;

    const start = parseICSDate(dtstartLine.trim());
    const end = parseICSDate(dtendLine.trim());
    if (!start || !end) continue;
    if (end <= now) continue; // nur Zukunft
    if (start > until) continue;

    // auf 30-Min Raster
    const slotLenMin = 30;
    for (let t = new Date(start); t < end; t = new Date(t.getTime() + slotLenMin * 60000)) {
      const slotEnd = new Date(t.getTime() + slotLenMin * 60000);
      if (slotEnd > end) break;
      if (slotEnd <= now) continue;
      slots.push({
        start: new Date(t),
        end: slotEnd,
        key: `${t.toISOString()}_${slotEnd.toISOString()}`,
      });
    }
  }

  // sortieren
  slots.sort((a, b) => a.start - b.start);
  return slots;
}

export default function Home() {
  const [step, setStep] = useState(0);
  const totalSteps = 10; // <<<< jetzt inklusive Terminwahl (Step 9)
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

    // Step 8 – Pflichtfelder
    check_datenschutz: false,
    check_online_setting: false,
    check_gesundheit: false,

    // Step 9 – Terminwahl
    terminISO: "",
    terminDisplay: "",
  });

  const [activeIndex, setActiveIndex] = useState(0);

  // ---------- Matching ----------
  const sortedTeam = useMemo(() => {
    if (!form.anliegen) return teamData || [];
    const keywords = form.anliegen.toLowerCase().split(/[\s,.;!?]+/).filter(Boolean);

    return [...(teamData || [])].sort((a, b) => {
      const score = (member) =>
        member.tags?.filter((tag) =>
          keywords.some((word) => tag.toLowerCase().includes(word))
        ).length || 0;

      return score(b) - score(a);
    });
  }, [form.anliegen]);

  // ---------- Alterscheck ----------
  const isAdult = (dateString) => {
    const birth = new Date(dateString);
    const age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    return age > 18 || (age === 18 && m >= 0);
    // (Tagesgenauigkeit bei Tag < heutigem Tag ließe sich noch verfeinern)
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

  // ==========================
  // STEP 9 – Terminwahl (ICS)
  // ==========================
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  useEffect(() => {
    async function loadSlots() {
      if (step !== 9) return;
      setSlots([]);
      setSlotsError("");
      setLoadingSlots(true);

      try {
        const who = form.wunschtherapeut;
        const ics = ICS_BY_MEMBER[who];
        if (!who || !ics) {
          setSlotsError(
            !who
              ? "Bitte wähle zuerst eine Begleitung (Schritt 5)."
              : `Für ${who} ist noch kein Online-Kalender hinterlegt.`
          );
          setLoadingSlots(false);
          return;
        }

        const s = await loadIcsSlots(ics, 21);
        setSlots(s);
      } catch (e) {
        console.error(e);
        setSlotsError("Kalender konnte nicht geladen werden.");
      } finally {
        setLoadingSlots(false);
      }
    }
    loadSlots();
  }, [step, form.wunschtherapeut]);

  // Slots nach Tagen gruppieren
  const slotsByDay = useMemo(() => {
    const map = new Map();
    for (const s of slots) {
      const k = s.start.toDateString();
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    }
    return Array.from(map.entries())
      .map(([k, arr]) => ({ day: new Date(arr[0]?.start || k), list: arr }))
      // Fallback-Sort: fallback auf Key
      .sort((a, b) => new Date(a.list[0].start) - new Date(b.list[0].start));
  }, [slots]);

  return (
    <div className="form-wrapper">
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <Image src="/IMG_7599.png" alt="Poise Logo" width={160} height={160} priority />
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

      {/* ---------- STEP 5 Matching-Auswahl ---------- */}
      {step === 5 && (
        <div className="step-container">
          {isRedFlag(form.anliegen) ? (
            <>
              <h2>Vielen Dank für deine Offenheit</h2>
              <p style={{ whiteSpace: "pre-line", lineHeight: 1.55 }}>
{`Vielen Dank für deine Anfrage! Erst einmal freut es uns, dass du dir vorstellen könntest mit uns zu arbeiten :) Das ist ein schönes Kompliment. Danke für dein Vertrauen und deine Offenheit.

Leider begleiten wir dein Thema nicht im Online-Setting. Uns ist es wichtig, dass unsere Psychologinnen und Therapeutinnen nah genug dran sind, um optimal intervenieren zu können, damit du effizient und nachhaltig zu einem gesunden Umgang mit deiner Thematik findest und Linderung spürst. Daher sind wir gezwungen, nur eine Auswahl an psychologischen Themenfeldern im reinen Online-Setting umzusetzen.

Falls du in Deutschland wohnst, können wir dir folgende Adressen empfehlen, um einen Psychotherapie vor Ort zu beantragen, die von der Krankenkasse finanziert wird: 

Wende dich an die 116117. Über die kassenärztliche Vereinigung kannst du eine psychotherapeutische Praxis in deiner Nähe finden, die dir innerhalb von 4 Wochen ein Erstgespräch geben sollte. Voraussetzung dafür ist, dass du bei deinem Hausarzt einen Dringlichkeitscode beantragt hast. Du kannst die 116117 telefonisch oder über die Website https://www.116117.de erreichen. 

Schau nach Ausbildungsinstituten für Psychotherapie. Auch hier solltest du mit weniger Wartezeit einen Therapieplatz bekommen.

Auch Tageskliniken können eine gute Option sein.
Für die Schweiz können wir die Internetseite https://www.therapievermittlung.ch/ empfehlen. Hier kannst du gezielt nach Psychotherapeuten*innen in deiner Nähe und nach Fachrichtung suchen. 
Für Österreich empfiehlt sich ein Blick auf https://www.psychotherapie.at/ 
Tageskliniken sind auch in der Schweiz und in Österreich eine gute Alternative, falls es mit der Psychotherapie in deiner Nähe nicht klappen sollte. 
Wir hoffen, dass wir dir Ideen für das weitere Vorgehen geben konnten und du dich traust den Weg zu deiner mentalen Gesundheit weiter zu gehen. Wir wünschen dir von Herzen alles Gute!`}
              </p>

              <div className="footer-buttons">
                <button onClick={back}>Zurück</button>
                <button onClick={next}>Weiter</button>
              </div>
            </>
          ) : (
            <>
              <h2>Wer könnte gut zu dir passen?</h2>
              <p style={{ opacity: 0.8, marginBottom: 16 }}>
                Basierend auf deinem Anliegen schlagen wir dir passende Begleitungen vor.
              </p>

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

      {/* ---------- STEP 6 Kontaktdaten ---------- */}
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

      {/* ---------- STEP 7 Beschäftigung ---------- */}
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

      {/* ---------- STEP 8 Datenschutz & Voraussetzungen ---------- */}
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
            Ich habe die Datenschutzerklärung zur Kenntnis genommen und akzeptiert. Ich stimme zu,
            dass meine Angaben zur Kontaktaufnahme gespeichert werden.
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.check_online_setting}
              onChange={() =>
                setForm({ ...form, check_online_setting: !form.check_online_setting })
              }
            />
            Ich bestätige, dass ich über ein geeignetes Endgerät mit Kamera & Mikrofon verfüge
            und das Coaching in einer ruhigen Umgebung stattfindet.
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.check_gesundheit}
              onChange={() =>
                setForm({ ...form, check_gesundheit: !form.check_gesundheit })
              }
            />
            Ich bestätige, dass ich weder unter Suizidgedanken, selbstverletzendem Verhalten
            noch unter einer Essstörung oder Suchtproblematik leide.
          </label>

          <div className="footer-buttons">
            <button onClick={back}>Zurück</button>
            <button
              disabled={
                !form.check_datenschutz ||
                !form.check_online_setting ||
                !form.check_gesundheit
              }
              onClick={next}
            >
              Weiter
            </button>
          </div>
        </div>
      )}

      {/* ---------- STEP 9 Terminwahl (ICS) ---------- */}
      {step === 9 && (
        <div className="step-container">
          <h2>Erstgespräch – Termin wählen</h2>
          <p style={{ opacity: 0.8, margin: "6px 0 16px" }}>
            Wähle einen freien Termin bei {form.wunschtherapeut || "deiner Begleitung"} in den nächsten 3 Wochen.
          </p>

          {!form.wunschtherapeut && (
            <p style={{ color: "#b00" }}>
              Bitte zuerst im Schritt 5 eine Begleitung auswählen.
            </p>
          )}

          {loadingSlots && <p>Kalender wird geladen …</p>}
          {slotsError && <p style={{ color: "#b00" }}>{slotsError}</p>}

          {!loadingSlots && !slotsError && slots.length === 0 && (
            <p>Aktuell sind keine freien Termine sichtbar. Bitte versuche es später erneut.</p>
          )}

          {/* Slots gruppiert nach Tagen */}
          {!loadingSlots && slots.length > 0 && (
            <div>
              {Array.from(
                slots.reduce((acc, s) => {
                  const key = s.start.toDateString();
                  if (!acc.has(key)) acc.set(key, []);
                  acc.get(key).push(s);
                  return acc;
                }, new Map())
              ).map(([dayKey, entries]) => {
                const day = entries[0].start;
                return (
                  <div key={dayKey} style={{ marginBottom: 18 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>
                      {formatDate(day)}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {entries.map((s) => (
                        <button
                          key={s.key}
                          onClick={() => {
                            setForm({
                              ...form,
                              terminISO: s.start.toISOString(),
                              terminDisplay: `${formatDate(s.start)} ${formatTime(s.start)} – ${formatTime(
                                s.end
                              )}`,
                            });
                          }}
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
                );
              })}
            </div>
          )}

          {/* Auswahl-Info */}
          {form.terminISO && (
            <p style={{ marginTop: 12 }}>
              Gewählt: <strong>{form.terminDisplay}</strong>
            </p>
          )}

          <div className="footer-buttons" style={{ marginTop: 16 }}>
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
