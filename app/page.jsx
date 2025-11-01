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

  return (
  <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px" }}>
    <h1>Poise Connect Anfrage</h1>

    {sent ? (
      <p style={{ padding: "20px", background: "#e7ffe7", borderRadius: "8px" }}>
        Danke! Deine Anfrage wurde erfolgreich gesendet.
      </p>
    ) : (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setErr("");

          try {
            const res = await fetch("/api/submit", {
              method: "POST",
              body: JSON.stringify(form),
              headers: { "Content-Type": "application/json" },
            });

            if (!res.ok) throw new Error("Fehler beim Absenden");
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
              bevorzugte_zeit: "",
            });
          } catch (e) {
            setErr("Es ist ein Fehler aufgetreten. Bitte versuche es erneut.");
          } finally {
            setLoading(false);
          }
        }}
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <input placeholder="Vorname"
          value={form.vorname}
          onChange={(e) => setForm({ ...form, vorname: e.target.value })} />

        <input placeholder="Nachname"
          value={form.nachname}
          onChange={(e) => setForm({ ...form, nachname: e.target.value })} />

        <input type="email" placeholder="E-Mail"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />

        <textarea placeholder="Dein Anliegen"
          value={form.anliegen}
          onChange={(e) => setForm({ ...form, anliegen: e.target.value })}
          style={{ minHeight: "120px" }}
        />

        <select
          value={form.wunschtherapeut}
          onChange={(e) => setForm({ ...form, wunschtherapeut: e.target.value })}
        >
          <option value="">Wunschtherapeut auswählen</option>
          {team.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <label>
          <input
            type="checkbox"
            checked={form.check_datenschutz}
            onChange={() => setForm({ ...form, check_datenschutz: !form.check_datenschutz })}
            required
          /> Datenschutz akzeptieren
        </label>

        {err && <p style={{ color: "red" }}>{err}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{
            background: "#000",
            color: "#fff",
            padding: "14px",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          {loading ? "Senden..." : "Absenden"}
        </button>
      </form>
    )}
  </div>
);
}
