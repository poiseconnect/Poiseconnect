"use client";
import { useState } from "react";

export default function Home() {
  const [form, setForm] = useState({
    vorname: "",
    nachname: "",
    email: "",
    strasse_hausnr: "",
    plz_ort: "",
    geburtsdatum: "",
    beschaeftigungsgrad: "",
    leidensdruck: "",
    anliegen: "",
    verlauf: "",
    ziel: "",
    wunschtherapeut: "",
    check_suizid: false,
    check_datenschutz: false,
    bevorzugte_zeit: ""
  });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(""); 
  

  const team = [
    "Linda",
    "Ann",
    "Anna",
    "Anja",
    "Babette",
    "Carolin",
    "Caroline",
    "Elena",
    "Franziska",
    "Gerhard",
    "Gesine",
    "Isabella",
    "Jenny",
    "Judith",
    "Julius",
    "Kristin",
    "Kristin-Sofie",
    "Livia",
    "Magdalena",
    "Marisa",
    "Marleen",
    "Sophie",
    "Yanina",
    "Keine Präferenz",
  ];

  const leidensdruckOptionen = Array.from({ length: 10 }, (_, i) => i + 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.check_datenschutz) {
      setErr("Bitte stimmen Sie der Datenschutzerklärung zu.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
        setForm({
          vorname: "",
          nachname: "",
          email: "",
          strasse_hausnr: "",
          plz_ort: "",
          geburtsdatum: "",
          beschaeftigungsgrad: "",
          leidensdruck: "",
          anliegen: "",
          verlauf: "",
          ziel: "",
          wunschtherapeut: "",
          check_suizid: false,
          check_datenschutz: false,
          bevorzugte_zeit: ""
        });
      } else {
        setErr(data.error || "Fehler beim Senden.");
      }
    } catch (error) {
      setErr("Netzwerkfehler.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-semibold mb-4">
            Danke — deine Anfrage ist eingegangen
          </h1>
          <p>Wir melden uns innerhalb von 24 Stunden bei dir.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl bg-white p-6 rounded shadow space-y-3"
      >
        <h1 className="text-xl font-bold mb-2">Kontaktformular — Poise Connect</h1>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block mb-1">Vorname *</label>
            <input
              required
              value={form.vorname}
              onChange={(e) => setForm({ ...form, vorname: e.target.value })}
              className="w-full p-2 border rounded"
              placeholder="Vorname"
            />
          </div>
          <div>
            <label className="block mb-1">Nachname *</label>
            <input
              required
              value={form.nachname}
              onChange={(e) => setForm({ ...form, nachname: e.target.value })}
              className="w-full p-2 border rounded"
              placeholder="Nachname"
            />
          </div>
        </div>

        <label className="block mb-1">E-Mail *</label>
        <input
          required
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full p-2 border rounded"
          placeholder="name@beispiel.de"
        />

        <label className="block mb-1">Straße & Hausnummer</label>
        <input
          value={form.strasse_hausnr}
          onChange={(e) => setForm({ ...form, strasse_hausnr: e.target.value })}
          className="w-full p-2 border rounded"
          placeholder="Musterstraße 1"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block mb-1">PLZ / Ort</label>
            <input
              value={form.plz_ort}
              onChange={(e) => setForm({ ...form, plz_ort: e.target.value })}
              className="w-full p-2 border rounded"
              placeholder="1010 Wien"
            />
          </div>
          <div>
            <label className="block mb-1">Geburtsdatum</label>
            <input
              type="date"
              value={form.geburtsdatum}
              onChange={(e) =>
                setForm({ ...form, geburtsdatum: e.target.value })
              }
              className="w-full p-2 border rounded"
            />
          </div>
        </div>

        <label className="block mb-1">
          Beschäftigungsgrad / Berufstätig / in Ausbildung
        </label>
        <input
          value={form.beschaeftigungsgrad}
          onChange={(e) =>
            setForm({ ...form, beschaeftigungsgrad: e.target.value })
          }
          className="w-full p-2 border rounded"
          placeholder="z. B. Vollzeit, Teilzeit, in Ausbildung"
        />

        <label className="block mb-1">Wie hoch ist dein Leidensdruck (1–10)?</label>
        <select
          value={form.leidensdruck}
          onChange={(e) => setForm({ ...form, leidensdruck: e.target.value })}
          className="w-full p-2 border rounded"
        >
          <option value="">Bitte auswählen</option>
          {leidensdruckOptionen.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <label className="block mb-1">
          Anliegen (Beschreibung des Themas / psychisches Problem) *
        </label>
        <textarea
          required
          value={form.anliegen}
          onChange={(e) => setForm({ ...form, anliegen: e.target.value })}
          className="w-full p-2 border rounded"
          rows="4"
          placeholder="Beschreibe kurz dein Anliegen"
        ></textarea>

        <label className="block mb-1">Verlauf deines Problems</label>
        <textarea
          value={form.verlauf}
          onChange={(e) => setForm({ ...form, verlauf: e.target.value })}
          className="w-full p-2 border rounded"
          rows="3"
          placeholder="Wie hat sich das entwickelt?"
        ></textarea>

        <label className="block mb-1">Ziel / Wunsch für die Sitzung</label>
        <textarea
          value={form.ziel}
          onChange={(e) => setForm({ ...form, ziel: e.target.value })}
          className="w-full p-2 border rounded"
          rows="2"
          placeholder="Was möchtest du erreichen?"
        ></textarea>

        <label className="block mb-1">Wunschtherapeut:in</label>
        <select
          value={form.wunschtherapeut}
          onChange={(e) =>
            setForm({ ...form, wunschtherapeut: e.target.value })
          }
          className="w-full p-2 border rounded"
        >
          <option value="">Bitte auswählen</option>
          {team.map((person) => (
            <option key={person} value={person}>
              {person}
            </option>
          ))}
        </select>

        <label className="block mb-1">Bevorzugte Zeit</label>
        <input
          value={form.bevorzugte_zeit}
          onChange={(e) =>
            setForm({ ...form, bevorzugte_zeit: e.target.value })
          }
          className="w-full p-2 border rounded"
          placeholder="z. B. Montag Vormittag"
        />

        <div className="flex items-center gap-3">
          <input
            id="suizid"
            type="checkbox"
            checked={form.check_suizid}
            onChange={(e) =>
              setForm({ ...form, check_suizid: e.target.checked })
            }
          />
          <label htmlFor="suizid">
            Ich habe derzeit keine akuten Suizidgedanken
          </label>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="datenschutz"
            type="checkbox"
            checked={form.check_datenschutz}
            onChange={(e) =>
              setForm({ ...form, check_datenschutz: e.target.checked })
            }
          />
          <label htmlFor="datenschutz">
            Ich stimme der Datenschutzerklärung zu *
          </label>
        </div>

        {err && <p className="text-red-600">{err}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded"
        >
          {loading ? "Sende..." : "Absenden"}
        </button>
      </form>
    </main>
  );
}
