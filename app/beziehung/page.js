// NOTE:
// Replace the contents of your app/beziehung/page.js with the code below.

"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function BeziehungContent() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();
  const source = searchParams.get("source") || "beziehung_landingpage";

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
          interest: "Beziehungen",
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
        minHeight: "100vh",
        background:
          "linear-gradient(180deg,#f7f3ef 0%,#ffffff 45%,#faf8f6 100%)",
        color: "#302b27",
        padding: "40px 20px 70px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 620,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <div style={{ marginBottom: 34 }}>
          <Image
            src="/IMG_7599.png"
            alt="Poise"
            width={240}
            height={90}
            priority
            style={{
              width: "auto",
              height: 60,
              maxWidth: "80%",
              objectFit: "contain",
            }}
          />
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 420,
            aspectRatio: "4 / 5",
            margin: "0 auto 32px",
            borderRadius: 30,
            overflow: "hidden",
            boxShadow: "0 18px 50px rgba(70,55,45,.14)",
          }}
        >
          <Image
            src="/linda-beziehung.jpg"
            alt="Psychologin Linda Leinweber"
            fill
            priority
            sizes="(max-width:640px) 90vw, 420px"
            style={{
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
        </div>

        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "#8a7465",
            marginBottom: 12,
          }}
        >
          Psychologische Impulse von Poise
        </p>

        <h1
          style={{
            fontSize: "clamp(34px,7vw,52px)",
            lineHeight: 1.08,
            marginBottom: 22,
          }}
        >
          Mehr Nähe, Verständnis und Verbindung in deiner Beziehung
        </h1>

        <p
          style={{
            fontSize: "clamp(17px,4vw,20px)",
            lineHeight: 1.6,
            color: "#665d56",
            marginBottom: 28,
          }}
        >
          Erhalte fundierte psychologische Impulse rund um Beziehung,
          Kommunikation, Bindung und einen gesunden Umgang mit Konflikten.
        </p>

        <p
          style={{
            marginBottom: 30,
            color: "#665d56",
            fontSize: 16,
          }}
        >
          💛 Von Psychologin <strong>Linda Leinweber</strong>
        </p>

        <div
          style={{
            background: "#fff",
            borderRadius: 24,
            padding: 30,
            boxShadow: "0 16px 40px rgba(0,0,0,.08)",
          }}
        >
          {!submitted ? (
            <>
              <h2 style={{ marginBottom: 10 }}>
                Kostenlose Beziehungsimpulse erhalten
              </h2>

              <p
                style={{
                  color: "#71675f",
                  marginBottom: 24,
                }}
              >
                Trage deine E-Mail-Adresse ein und erhalte regelmäßig
                psychologische Impulse.
              </p>

              <form onSubmit={handleSubmit}>
                <input
                  type="email"
                  placeholder="Deine E-Mail-Adresse"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  style={{
                    width: "100%",
                    padding: 17,
                    borderRadius: 14,
                    border: "1px solid #d8d0c9",
                    marginBottom: 14,
                    fontSize: 16,
                    boxSizing: "border-box",
                  }}
                />

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: 17,
                    borderRadius: 14,
                    border: "none",
                    background: "#302b27",
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.65 : 1,
                  }}
                >
                  {loading
                    ? "Wird angemeldet..."
                    : "Kostenlose Beziehungsimpulse erhalten"}
                </button>

                <p
                  style={{
                    marginTop: 16,
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: "#81766e",
                  }}
                >
                  Mit deiner Anmeldung erhältst du psychologische Impulse,
                  Angebote und Neuigkeiten von Poise per E-Mail. Du kannst dich
                  jederzeit wieder abmelden.
                </p>
              </form>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: 12 }}>
              <div style={{ fontSize: 42 }}>💛</div>
              <h2>Danke für deine Anmeldung!</h2>
              <p>
                Schau jetzt in dein E-Mail-Postfach. Dort erhältst du in Kürze
                deine ersten Beziehungsimpulse.
              </p>
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
            gap: 14,
            marginTop: 24,
          }}
        >
          {[
            ["🧠", "Psychologisch fundiert"],
            ["💬", "Praktisch im Alltag"],
            ["🌿", "Einfühlsam erklärt"],
          ].map(([icon, text]) => (
            <div
              key={text}
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 24 }}>{icon}</div>
              <strong>{text}</strong>
            </div>
          ))}
        </div>

        <p
          style={{
            marginTop: 28,
            fontSize: 12,
            color: "#8b8179",
          }}
        >
          Die Inhalte ersetzen keine individuelle psychologische Beratung,
          Psychotherapie oder medizinische Behandlung.
        </p>
      </section>
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
