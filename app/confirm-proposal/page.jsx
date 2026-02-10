"use client";

export const dynamic = "force-dynamic";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ConfirmProposalPage() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId");

  const [done, setDone] = useState(false);

  async function confirm() {
    await fetch("/api/confirm-proposal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });

    setDone(true);
  }

  if (done) {
    return (
      <div style={{ padding: 40 }}>
        <h2>✅ Termin bestätigt</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>Termin bestätigen</h2>

      <button onClick={confirm}>
        ✅ Bestätigen
      </button>
    </div>
  );
}
