"use client";

import { useEffect, useState } from "react";

export default function BookingPage({ params }) {
  const { token } = params;

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    loadSlots();
  }, []);

  async function loadSlots() {
    const res = await fetch(`/api/booking/slots?token=${token}`);
    const json = await res.json();

    if (res.ok) {
      setSlots(json.slots || []);
    } else {
      console.error(json);
      alert("Fehler beim Laden der Slots");
    }

    setLoading(false);
  }

  async function bookSlot() {
    if (!selected) return;

    const res = await fetch("/api/booking/book", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        slot: selected,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      alert("Fehler bei Buchung");
      console.error(json);
      return;
    }

    alert("✅ Termin gebucht!");
    loadSlots();
  }

  if (loading) {
    return <div style={{ padding: 40 }}>Lade Termine…</div>;
  }

  return (
    <div style={{ padding: 40, maxWidth: 600, margin: "0 auto" }}>
      <h1>Termin buchen</h1>

      {slots.length === 0 && (
        <div>Keine freien Termine verfügbar</div>
      )}

      {slots.map((s, i) => (
        <div
          key={i}
          onClick={() => setSelected(s)}
          style={{
            padding: 12,
            marginBottom: 10,
            border: "1px solid #ccc",
            borderRadius: 8,
            cursor: "pointer",
            background:
              selected === s ? "#E8FFF0" : "#fff",
          }}
        >
          {new Date(s.start).toLocaleString("de-AT")}
        </div>
      ))}

      <button
        onClick={bookSlot}
        disabled={!selected}
        style={{ marginTop: 20 }}
      >
        Termin bestätigen
      </button>
    </div>
  );
}
