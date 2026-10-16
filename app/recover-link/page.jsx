"use client";

import { useEffect, useState } from "react";
import ClientLinkRecovery from "../components/ClientLinkRecovery";

export default function RecoverLinkPage() {
  const [secret, setSecret] = useState("");
  const [purpose, setPurpose] = useState("draft");
  useEffect(() => {
    const value = window.location.hash.slice(1);
    const requestedPurpose = new URLSearchParams(window.location.search).get("purpose");
    if (["draft", "coach-selection", "appointment", "proposal"].includes(requestedPurpose)) {
      setPurpose(requestedPurpose);
    }
    window.history.replaceState(null, "", window.location.pathname);
    if (/^[a-f0-9]{64}$/.test(value)) setSecret(value);
  }, []);
  if (!secret) return <ClientLinkRecovery purpose={purpose} choosePurpose />;
  return (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: 24 }}>
      <h1>Zugang öffnen</h1>
      <p>Bestätige, dass du mit deinem angeforderten Zugang fortfahren möchtest.</p>
      <form method="post" action="/api/client-link-recovery/consume">
        <input type="hidden" name="secret" value={secret} />
        <button type="submit">Sicher fortfahren</button>
      </form>
    </main>
  );
}
