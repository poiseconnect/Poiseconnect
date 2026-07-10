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
          "linear-gradient(180deg, #f7f3ef 0%, #ffffff 45%, #faf8f6 100%)",
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
        <div
          style={{
            marginBottom: 34,
          }}
        >
          <Image
            src="/poise-logo.png"
            alt="Poise"
            width={190}
            height={70}
            priority
            style={{
              width: "auto",
              height: 55,
              maxWidth: "75%",
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
            boxShadow: "0 18px 50px rgba(70, 55, 45, 0.14)",
            background: "#eee8e2",
          }}
        >
          <Image
            src="/linda-beziehung.jpg"
            alt="Psychologin Linda Leinweber"
            fill
            priority
            sizes="(max-width: 640px) 90vw, 420px"
            style={{
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
        </div>

        <p
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#8a7465",
          }}
        >
          Psychologische Impulse von Poise
        </p>

        <h1
          style={{
            maxWidth: 580,
            margin: "0 auto 22px",
            fontSize: "clamp(34px, 7vw, 52px)",
            lineHeight: 1.08,
            letterSpacing: "-0.035em",
            fontWeight: 700,
          }}
        >
          Mehr Nähe, Verständnis und Verbindung in deiner Beziehung
        </h1>

        <p
          style={{
            maxWidth: 540,
            margin: "0 auto",
            fontSize: "clamp(17px, 4vw, 20px)",
            lineHeight: 1.65,
            color: "#665d56",
          }}
        >
          Erhalte fundierte psychologische Impulse rund um Beziehung,
          Kommunikation, Bindung und einen gesunden Umgang mit Konflikten.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            margin: "26px auto 34px",
            fontSize: 15,
            color: "#625850",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "#eee4dc",
              fontSize: 17,
            }}
          >
            💛
          </span>

          <span>
            Von Psychologin <strong>Linda Leinweber</strong>
          </span>
        </div>

        <div
          style={{
            background: "rgba(255, 255, 255, 0.92)",
            border: "1px solid rgba(111, 90, 75, 0.13)",
            borderRadius: 26,
            padding: "clamp(24px, 6vw, 38px)",
            boxShadow: "0 16px 50px rgba(70, 55, 45, 0.09)",
            textAlign: "left",
          }}
        >
          {!submitted ? (
            <>
              <h2
                style={{
                  margin: "0 0 8px",
                  textAlign: "center",
                  fontSize: 25,
                  lineHeight: 1.25,
                }}
              >
                Kostenlose Beziehungsimpulse erhalten
              </h2>

              <p
                style={{
                  margin: "0 0 24px",
                  textAlign: "center",
                  color: "#71675f",
                  fontSize: 15,
                  lineHeight: 1.55,
                }}
              >
                Trage deine E-Mail-Adresse ein und erhalte unsere Impulse
                direkt in dein Postfach.
              </p>

              <form onSubmit={handleSubmit}>
                <label
                  htmlFor="email"
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  E-Mail-Adresse
                </label>

                <input
                  id="email"
                  type="email"
                  placeholder="deine@email.at"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "17px 18px",
                    borderRadius: 14,
                    border: "1px solid #d8d0c9",
                    marginBottom: 14,
                    fontSize: 16,
                    color: "#302b27",
                    background: "#fff",
                    outline: "none",
                  }}
                />

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "17px 18px",
                    borderRadius: 14,
                    border: "none",
                    background: "#302b27",
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.65 : 1,
                    transition: "opacity 0.2s ease",
                  }}
                >
                  {loading
                    ? "Wird angemeldet …"
                    : "Kostenlose Impulse erhalten"}
                </button>

                <p
                  style={{
                    margin: "15px 0 0",
                    textAlign: "center",
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: "#81766e",
                  }}
                >
                  Mit deiner Anmeldung erhältst du psychologische Impulse,
                  Angebote und Neuigkeiten von Poise per E-Mail. Du kannst
                  dich jederzeit wieder abmelden.
                </p>
              </form>
            </>
          ) : (
            <div
              style={{
                padding: "14px 4px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 44,
                  marginBottom: 14,
                }}
              >
                💛
              </div>

              <h2
                style={{
                  margin: "0 0 12px",
                  fontSize: 27,
                }}
              >
                Danke für deine Anmeldung!
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "#6d635b",
                  fontSize: 17,
                  lineHeight: 1.6,
                }}
              >
                Schau jetzt in dein E-Mail-Postfach. Dort erhältst du deine
                psychologischen Impulse für mehr Verbindung in deiner
                Beziehung.
              </p>
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
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
                padding: "18px 12px",
                borderRadius: 18,
                background: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(111, 90, 75, 0.1)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  marginBottom: 7,
                }}
              >
                {icon}
              </div>

              {text}
            </div>
          ))}
        </div>

        <p
          style={{
            marginTop: 30,
            fontSize: 12,
            lineHeight: 1.5,
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
