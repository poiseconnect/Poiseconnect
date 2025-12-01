"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const sendLink = async () => {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      setSent(true);
    } else {
      alert("Fehler – Magic Link konnte nicht gesendet werden.");
    }
  };

  return (
    <div style={{ maxWidth: 340, margin: "80px auto", textAlign: "center" }}>
      <h1>Team Login</h1>

      {!sent ? (
        <>
          <p>Gib deine E-Mail-Adresse ein.</p>
          <input
            type="email"
            placeholder="name@beispiel.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
              marginTop: 10,
            }}
          />

          <button
            onClick={sendLink}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              borderRadius: 8,
              background: "#A27C77",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
            disabled={!email}
          >
            Magic Link senden
          </button>
        </>
      ) : (
        <p>Magic Link wurde gesendet. Bitte prüfe dein E-Mail-Postfach.</p>
      )}
    </div>
  );
}
