"use client";

import { useState } from "react";

export default function Page() {
  const [form, setForm] = useState({
    name: "",
    vorname: "",
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
    bevorzugte_zeit: "",
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

  const leidensdruckOptionen = [
    "Gering",
    "Mittel",
    "Stark",
    "Sehr stark"
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Fehler beim Senden");

      setSent(true);
    } catch (error) {
      setErr("Das hat leider nicht geklappt. Bitte später erneut versuchen.");
    }

    setLoading(false);
  };

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto" }}>
      <h1>Poise Connect Anfrage</h1>

      {sent ? (
        <p>Danke! Wir melden uns bei dir.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label>Name</label>
          <input name="name" value={form.name} onChange={handleChange} />

          <label>Wunschtherapeut</label>
          <select name="wunschtherapeut" value={form.wunschtherapeut} onChange={handleChange}>
            {team.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          <label>Leidensdruck</label>
          <select name="leidensdruck" value={form.leidensdruck} onChange={handleChange}>
            {leidensdruckOptionen.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>

          <button type="submit" disabled={loading}>
            {loading ? "Senden..." : "Absenden"}
          </button>

          {err && <p style={{ color: "red" }}>{err}</p>}
        </form>
      )}
    </div>
  );
}
