"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function TerminVerwaltenPage() {
  const params = useParams();
  const token = params?.token;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
const [cancelled, setCancelled] = useState(false);
  const [requestingChange, setRequestingChange] = useState(false);
const [changeRequested, setChangeRequested] = useState(false);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const res = await fetch(
          `/api/client/appointment?token=${encodeURIComponent(token)}`
        );

        const json = await res.json();

        if (!res.ok) {
          setError(json?.error || "Termin konnte nicht geladen werden.");
          return;
        }

        setData(json);
      } catch (err) {
        console.error("APPOINTMENT LOAD FAILED:", err);
        setError("Termin konnte nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);
  async function cancelAppointment() {
  const confirmed = window.confirm(
    "Möchtest du diesen Termin wirklich absagen?"
  );

  if (!confirmed) return;

  try {
    setCancelling(true);

    const res = await fetch("/api/client/appointment/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      console.error("CANCEL APPOINTMENT ERROR:", json);

      alert(
        json?.message ||
          "Der Termin konnte nicht abgesagt werden."
      );

      return;
    }

    setCancelled(true);
  } catch (err) {
    console.error("CANCEL APPOINTMENT FAILED:", err);

    alert("Der Termin konnte nicht abgesagt werden.");
  } finally {
    setCancelling(false);
  }
}
async function changeAppointment() {
  // Proposal-Modus:
  // Der Coach soll neue Vorschläge schicken.
  if (data?.calendarMode === "proposal") {
    const confirmed = window.confirm(
      "Möchtest du einen anderen Termin anfragen? Dein aktueller Termin bleibt bestehen, bis ein neuer Termin bestätigt wurde."
    );

    if (!confirmed) return;

    try {
      setRequestingChange(true);

      const res = await fetch(
        "/api/client/appointment/reschedule-request",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        console.error("RESCHEDULE REQUEST ERROR:", json);

        alert(
          json?.message ||
            "Der Änderungswunsch konnte nicht gesendet werden."
        );

        return;
      }

      setChangeRequested(true);
    } catch (err) {
      console.error("RESCHEDULE REQUEST FAILED:", err);

      alert(
        "Der Änderungswunsch konnte nicht gesendet werden."
      );
    } finally {
      setRequestingChange(false);
    }

    return;
  }

  // Booking-Modus bauen wir danach.
  if (data?.calendarMode === "booking") {
    alert(
      "Die direkte Umbuchung wird im nächsten Schritt aktiviert."
    );

    return;
  }

  alert("Terminänderung ist für diesen Termin nicht verfügbar.");
}
  if (loading) {
    return <div style={{ padding: 40 }}>Termin wird geladen…</div>;
  }

  if (error) {
    return <div style={{ padding: 40 }}>{error}</div>;
  }
if (cancelled) {
  return (
    <div
      style={{
        maxWidth: 600,
        margin: "0 auto",
        padding: 32,
      }}
    >
      <h1>Termin abgesagt</h1>

      <p style={{ marginTop: 16 }}>
        Dein Termin wurde erfolgreich abgesagt.
      </p>
    </div>
  );
}
  if (changeRequested) {
  return (
    <div
      style={{
        maxWidth: 600,
        margin: "0 auto",
        padding: 32,
      }}
    >
      <h1>Änderungswunsch gesendet</h1>

      <p style={{ marginTop: 16 }}>
        Dein aktueller Termin bleibt vorerst bestehen.
      </p>

      <p style={{ marginTop: 8 }}>
        Dein Coach wurde informiert und kann dir neue
        Terminvorschläge senden.
      </p>
    </div>
  );
}
  if (!data) {
    return <div style={{ padding: 40 }}>Kein Termin gefunden.</div>;
  }

  const start = new Date(data.start);

  return (
    <div
      style={{
        maxWidth: 600,
        margin: "0 auto",
        padding: 32,
      }}
    >
      <h1>Dein Termin</h1>

      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 20,
          marginTop: 24,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          {start.toLocaleDateString("de-AT", {
            timeZone: "Europe/Vienna",
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </div>

        <div>
          {start.toLocaleTimeString("de-AT", {
            timeZone: "Europe/Vienna",
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          Uhr
        </div>

        {data.therapistName && (
          <div style={{ marginTop: 8 }}>
            bei {data.therapistName}
          </div>
        )}
      </div>

           <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginTop: 24,
        }}
      >
<button
  type="button"
  onClick={changeAppointment}
  disabled={requestingChange}
  style={{
    padding: "12px 16px",
    borderRadius: 12,
    border: "none",
    cursor: requestingChange
      ? "not-allowed"
      : "pointer",
  }}
>
  {requestingChange
    ? "Anfrage wird gesendet…"
    : data.calendarMode === "proposal"
      ? "Anderen Termin anfragen"
      : "Termin ändern"}
</button>

        <button
          type="button"
          onClick={cancelAppointment}
          disabled={cancelling}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: cancelling ? "not-allowed" : "pointer",
          }}
        >
          {cancelling
            ? "Termin wird abgesagt…"
            : "Termin absagen"}
        </button>
      </div>
    </div>
  );
}
