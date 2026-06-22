"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// 👇 HIER EINFÜGEN
function safeDateString(v) {
  if (!v) return "";

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleString("de-AT", {
    timeZone: "Europe/Vienna",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ConfirmProposalPage() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get("request");

  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState([]);
  const [done, setDone] = useState(false);

  // ------------------------------------------------
  // Vorschläge laden
  // ------------------------------------------------
  useEffect(() => {
    if (!requestId) return;

    (async () => {
      const res = await fetch("/api/proposals/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });

      const data = await res.json();

      if (res.ok) {
        setProposals(data || []);
      }

      setLoading(false);
    })();
  }, [requestId]);

  // ------------------------------------------------
  // Termin bestätigen
  // ------------------------------------------------
  async function confirm(proposalId) {
    const res = await fetch("/api/confirm-proposal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, proposalId }),
    });

    if (res.ok) {
      setDone(true);
    } else {
      alert("Fehler beim Bestätigen");
    }
  }

  if (!requestId) return <div>Ungültiger Link</div>;

  if (loading) return <div>Lade Termine...</div>;

  if (done) {
    return (
      <div style={{ padding: 40 }}>
<h2>✅ Danke für deine Terminauswahl!</h2>

<p style={{ marginTop: 12 }}>
Dein Terminwunsch wurde erfolgreich übermittelt.
</p>

<p style={{ marginTop: 8 }}>
Dein:e Therapeut:in sendet dir den persönlichen Link für den Videocall
rechtzeitig per E-Mail zu.
</p>

<p style={{ marginTop: 8 }}>
Sollte der Termin inzwischen nicht mehr verfügbar sein,
bekommst du automatisch neue Terminvorschläge.
</p>

<p style={{ marginTop: 18, fontWeight: 500 }}>
Wir freuen uns auf dich 🤍
</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>Bitte wähle einen Termin</h2>

      {proposals.length === 0 && (
        <p>Keine Termine verfügbar.</p>
      )}

      {proposals.map((p) => (
        <div key={p.id} style={{ marginBottom: 12 }}>
          <button
            onClick={() => confirm(p.id)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #ccc",
              cursor: "pointer",
            }}
          >
{safeDateString(p.date)}
          </button>
        </div>
      ))}
    </div>
  );
}
