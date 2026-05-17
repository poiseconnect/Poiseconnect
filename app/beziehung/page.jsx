"use client";

import { useState } from "react";

export default function BeziehungPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    const res = await fetch("/api/klaviyo/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        consent: true,
        source: "relationship_landingpage",
      }),
    });

    if (res.ok) {
      setSubmitted(true);
    }
  }

  return (
    <main
      style={{
        maxWidth: 500,
        margin: "0 auto",
        padding: "80px 24px",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: 36,
          marginBottom: 16,
        }}
      >
        Beziehungstipps für mehr Ruhe & Verbindung 💛
      </h1>

      <p
        style={{
          fontSize: 18,
          lineHeight: 1.5,
          opacity: 0.8,
          marginBottom: 32,
        }}
      >
        Erhalte unsere liebsten Impulse rund um Beziehung,
        Kommunikation und emotionale Verbindung.
      </p>

      {!submitted ? (
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Deine E-Mail-Adresse"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 14,
              border: "1px solid #ddd",
              marginBottom: 16,
              fontSize: 16,
            }}
          />

          <button
            type="submit"
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 14,
              border: "none",
              background: "#111",
              color: "#fff",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Kostenlos erhalten
          </button>
        </form>
      ) : (
        <div>
          <h2>Danke 💛</h2>
          <p>Die Tipps sind bereits auf dem Weg zu dir.</p>
        </div>
      )}
    </main>
  );
}
