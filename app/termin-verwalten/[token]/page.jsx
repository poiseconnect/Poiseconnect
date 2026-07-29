"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function TerminVerwaltenPage() {
  const params = useParams();
  const token = params?.token;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

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

  if (loading) {
    return <div style={{ padding: 40 }}>Termin wird geladen…</div>;
  }

  if (error) {
    return <div style={{ padding: 40 }}>{error}</div>;
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
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
          }}
        >
          Termin ändern
        </button>

        <button
          type="button"
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Termin absagen
        </button>
      </div>
    </div>
  );
}
