export const dynamic = "force-dynamic";

"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ConfirmProposalPage() {
  const searchParams = useSearchParams();

  const requestId = searchParams.get("requestId");
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  async function confirm(date) {
    try {
      setLoading(true);

      const res = await fetch("/api/proposals/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          token,
          date,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Fehler");
      }

      setDone(true);
    } catch (e) {
      console.error(e);
      setError("Bestätigung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div style={{ padding: 40 }}>
        <h2>✅ Termin bestätigt</h2>
        <p>Danke! Der/die Therapeut:in wurde informiert.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>Termin auswählen</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <p>Wähle einen vorgeschlagenen Termin aus deiner Mail.</p>

      {loading && <p>Sende Bestätigung…</p>}
    </div>
  );
}
