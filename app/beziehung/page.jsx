"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function BeziehungContent() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();

  const source =
    searchParams.get("source") || "relationship_landingpage";

  async function handleSubmit(e) {
    e.preventDefault();

    if (!email) return;

    setLoading(true);

    try {
      const res = await fetch("/api/klaviyo/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          consent: true,
          source,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        alert("Die Anmeldung hat leider nicht funktioniert.");
      }
    } catch (err) {
      console.error("Newsletter signup failed:", err);
      alert("Die Anmeldung hat leider nicht funktioniert.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 520,
        margin: "0 auto",
        padding: "80px 24px",
        textAlign: "center",
        color: "#2f2924",
      }}
    >
      <h1 style={{ fontSize: 36, lineHeight: 1.15, marginBottom: 16 }}>
Impulse für mentale Gesundheit & emotionale Balance 💛
      </h1>

      <p
        style={{
          fontSize: 18,
          lineHeight: 1.55,
          opacity: 0.8,
          marginBottom: 32,
        }}
      >
Erhalte unsere liebsten Impulse rund um Stress, Ängste,
Beziehungen, Selbstwert und emotionale Balance..
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
            disabled={loading}
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 14,
              border: "none",
              background: "#111",
              color: "#fff",
              fontSize: 16,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Wird angemeldet…" : "Kostenlos erhalten"}
          </button>

          <p style={{ fontSize: 12, lineHeight: 1.4, opacity: 0.65, marginTop: 14 }}>
            Mit deiner Anmeldung erhältst du gelegentlich Impulse,
            Angebote und Neuigkeiten von Poise per E-Mail.
            Du kannst dich jederzeit wieder abmelden.
          </p>
        </form>
      ) : (
        <div>
          <h2>Danke 💛</h2>
          <p>Du bist angemeldet.</p>
        </div>
      )}
    </main>
  );
}

export default function BeziehungPage() {
  return (
    <Suspense fallback={null}>
      <BeziehungContent />
    </Suspense>
  );
}
