"use client";

import { useSearchParams } from "next/navigation";

export default function ConfirmProposal() {
  const params = useSearchParams();
  const id = params.get("id");

  async function confirm() {
    const res = await fetch("/api/confirm-proposal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposed_at: id }),
    });

    if (!res.ok) {
      alert("Fehler");
      return;
    }

    alert("Termin bestätigt 🤍");
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>Termin bestätigen</h2>
      <button onClick={confirm}>Jetzt bestätigen</button>
    </div>
  );
}
