"use client";

import { useEffect, useState } from "react";

export default function BookingPage({ params }) {
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState([]);
  const [booking, setBooking] = useState(false);

  async function loadSlots() {
    setLoading(true);

    const from = new Date().toISOString().slice(0, 10);

    const res = await fetch(
      `/api/booking/free-slots?token=${encodeURIComponent(token)}&from=${from}&days=21`
    );

    const json = await res.json();
    setSlots(json.slots || []);
    setLoading(false);
  }

  useEffect(() => {
    loadSlots();
  }, []);

  async function book(googleEventId) {
    setBooking(true);

    try {
      const res = await fetch("/api/booking/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          googleEventId,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || "Termin konnte nicht gebucht werden");
        return;
      }

      alert("✅ Termin erfolgreich gebucht");
      await loadSlots();
    } finally {
      setBooking(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 40 }}>Lade freie Termine…</div>;
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <h1>Termin buchen</h1>

      {slots.length === 0 ? (
        <div style={{ color: "#666" }}>
          Aktuell keine freien Termine verfügbar.
        </div>
      ) : (
        slots.map((day) => (
          <div
            key={day.day}
            style={{
              marginBottom: 18,
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 10 }}>
              {new Date(day.day).toLocaleDateString("de-AT", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {day.slots.map((slot) => (
                <button
                  key={slot.googleEventId}
                  disabled={booking}
                  onClick={() => book(slot.googleEventId)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {new Date(slot.start).toLocaleTimeString("de-AT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
