"use client";

import { useState } from "react";

export default function ClientLinkRecovery({ requestId, legacyProposal, purpose = "draft", choosePurpose = false }) {
  const [email, setEmail] = useState("");
  const [selectedPurpose, setSelectedPurpose] = useState(null);
  const [state, setState] = useState("ready");
  async function recover(event) {
    event.preventDefault();
    if (state === "sending") return;
    setState("sending");
    try {
      const response = await fetch("/api/client-link-recovery/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, legacyProposal, purpose: selectedPurpose || purpose, email }),
      });
      setState(response.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  }
  return (
    <section style={{ maxWidth: 560, margin: "40px auto", padding: 24 }}>
      <h2>Zugang per E-Mail erneuern</h2>
      <p>Dieser ältere oder ungültige Link kann nicht direkt geöffnet werden. Gib die E-Mail-Adresse deiner ursprünglichen Anfrage ein.</p>
      {state === "sent" ? (
        <p role="status">Wenn die Angaben zu einem bestehenden Zugang passen, erhältst du eine E-Mail mit den nächsten Schritten. Prüfe auch deinen Spam-Ordner.</p>
      ) : (
        <form onSubmit={recover}>
          {choosePurpose && <label>Wofür benötigst du den Zugang?
            <select value={selectedPurpose || purpose} onChange={(e) => setSelectedPurpose(e.target.value)}>
              <option value="draft">Begonnene Anfrage fortsetzen</option>
              <option value="coach-selection">Coach auswählen</option>
              <option value="appointment">Neuen Termin auswählen</option>
              <option value="proposal">Terminvorschläge öffnen</option>
            </select>
          </label>}
          <label>E-Mail-Adresse
            <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit" disabled={state === "sending"}>Neuen Zugangslink anfordern</button>
          {state === "failed" && <p role="alert">Bitte versuche es später erneut.</p>}
        </form>
      )}
      <p>Falls du keinen Zugang erhältst, hilft dir <a href="mailto:hallo@mypoise.de">hallo@mypoise.de</a>.</p>
      <a href="/">Neue Anfrage starten</a>
    </section>
  );
}
