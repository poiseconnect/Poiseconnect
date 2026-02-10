"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

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
        <h2>✅ Termin bestätigt</h2>
        <p>Wir freuen uns auf dich 🤍</p>
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
            {new Date(p.date).toLocaleString("de-DE")}
          </button>
        </div>
      ))}
    </div>
  );
}
