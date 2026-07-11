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

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail || loading) return;

    setLoading(true);

    try {
      const response = await fetch("/api/klaviyo/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
          consent: true,
          source,
          interest: "Beziehungen",
        }),
      });

      if (!response.ok) {
        throw new Error(`Newsletter signup failed: ${response.status}`);
      }

      setSubmitted(true);
    } catch (error) {
      console.error("Newsletter signup failed:", error);
      alert(
        "Die Anmeldung hat leider nicht funktioniert. Bitte versuche es noch einmal."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <main className="page">
        <section className="content">
          <div className="logoWrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Poise Logo Transparent Druck.png"
              alt="Poise by Linda Leinweber"
              className="logo"
            />
          </div>

          <div className="imageWrap">
            <Image
              src="/linda-beziehung.jpg"
              alt="Linda Leinweber"
              fill
              priority
              quality={78}
              sizes="(max-width: 700px) 94vw, 520px"
              className="portrait"
              style={{ objectFit: "cover", objectPosition: "center center" }}
            />
            <div className="scrim" />
            <div className="overlayText">
              <p className="eyebrow">
                Psychologische Impulse für Beziehungen
              </p>
              <h1>
                Impulse für mehr Nähe und Verbindung in deiner Beziehung
              </h1>
            </div>
          </div>

          <p className="intro">
            Trag dich ein und erhalte von Linda psychologisch fundierte,
            verständliche und alltagstaugliche Impulse zu Kommunikation,
            Bindung und Konflikten.
          </p>

          <div className="signupCard">
            {!submitted ? (
              <form onSubmit={handleSubmit}>
                <label htmlFor="email">Deine E-Mail-Adresse</label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="deine@email.at"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />

                <button type="submit" disabled={loading}>
                  {loading
                    ? "Wird angemeldet …"
                    : "Kostenlose Beziehungsimpulse erhalten"}
                </button>

                <div className="miniTrust">
                  <span>✓ Psychologisch fundiert</span>
                  <span>✓ Kostenlos</span>
                  <span>✓ Jederzeit abbestellbar</span>
                </div>

                <p className="privacy">
                  Mit deiner Anmeldung erhältst du psychologische Impulse,
                  Angebote und Neuigkeiten von Poise per E-Mail. Du kannst dich
                  jederzeit wieder abmelden.
                </p>
              </form>
            ) : (
              <div className="success" role="status" aria-live="polite">
                <div className="successIcon">💛</div>
                <h2>Danke für deine Anmeldung!</h2>
                <p>
                  Schau jetzt in dein E-Mail-Postfach. Dort erhältst du in Kürze
                  deine ersten Beziehungsimpulse.
                </p>
              </div>
            )}
          </div>

          <p className="note">
            Die Inhalte ersetzen keine individuelle psychologische Beratung,
            Psychotherapie oder medizinische Behandlung.
          </p>
        </section>
      </main>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          padding: 24px 16px 48px;
          color: #2f2925;
          background:
            radial-gradient(
              circle at top left,
              rgba(239, 220, 208, 0.72),
              transparent 34%
            ),
            linear-gradient(180deg, #f8f2ee 0%, #ffffff 50%, #fbf8f5 100%);
        }

        .content {
          width: 100%;
          max-width: 620px;
          margin: 0 auto;
          text-align: center;
        }

        .logoWrap {
          display: flex;
          justify-content: center;
          margin-bottom: 18px;
        }

        .logo {
          width: auto;
          height: 118px;
          object-fit: contain;
        }

        .imageWrap {
          position: relative;
          width: 100%;
          max-width: 520px;
          aspect-ratio: 4 / 5;
          margin: 0 auto 28px;
          overflow: hidden;
          border-radius: 28px;
          background: #eee6df;
          box-shadow:
            0 20px 50px rgba(57, 43, 35, 0.14),
            0 2px 8px rgba(57, 43, 35, 0.07);
        }

        .portrait {
          object-fit: cover;
          object-position: center center;
        }

        .scrim {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 62%;
          background: linear-gradient(
            180deg,
            rgba(47, 41, 37, 0) 0%,
            rgba(47, 41, 37, 0.55) 55%,
            rgba(47, 41, 37, 0.82) 100%
          );
          pointer-events: none;
        }

        .overlayText {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 0 28px 30px;
          text-align: left;
        }

        .overlayText .eyebrow {
          margin: 0 0 10px;
          color: #f0d9c8;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .overlayText h1 {
          margin: 0;
          color: #ffffff;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(28px, 6vw, 40px);
          font-weight: 500;
          line-height: 1.08;
          letter-spacing: -0.03em;
          text-shadow: 0 2px 20px rgba(0, 0, 0, 0.25);
        }

        .intro {
          max-width: 560px;
          margin: 0 auto 26px;
          color: #685e57;
          font-size: 18px;
          line-height: 1.6;
        }

        .signupCard {
          padding: 26px;
          border: 1px solid rgba(116, 88, 69, 0.13);
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 18px 45px rgba(57, 43, 35, 0.1);
          text-align: left;
        }

        label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 700;
        }

        input {
          width: 100%;
          padding: 17px 18px;
          border: 1px solid #d8cec6;
          border-radius: 14px;
          outline: none;
          background: #ffffff;
          color: #2f2925;
          font: inherit;
          font-size: 16px;
        }

        input:focus {
          border-color: #8c6e5b;
          box-shadow: 0 0 0 4px rgba(140, 110, 91, 0.12);
        }

        button {
          width: 100%;
          margin-top: 13px;
          padding: 17px 18px;
          border: none;
          border-radius: 14px;
          background: #2f2925;
          color: #ffffff;
          font: inherit;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(47, 41, 37, 0.18);
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.62;
        }

        .miniTrust {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px 14px;
          margin-top: 16px;
          color: #665c55;
          font-size: 12px;
          font-weight: 600;
        }

        .privacy {
          margin: 15px 0 0;
          color: #857970;
          font-size: 11px;
          line-height: 1.5;
          text-align: center;
        }

        .success {
          padding: 6px 0;
          text-align: center;
        }

        .successIcon {
          margin-bottom: 10px;
          font-size: 44px;
        }

        .success h2 {
          margin: 0 0 10px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 30px;
          font-weight: 500;
        }

        .success p {
          margin: 0;
          color: #6c625b;
          font-size: 16px;
          line-height: 1.6;
        }

        .note {
          max-width: 520px;
          margin: 24px auto 0;
          color: #8b8179;
          font-size: 11px;
          line-height: 1.5;
        }

        @media (max-width: 520px) {
          .page {
            padding: 18px 12px 40px;
          }

          .logo {
            width: 150px;
          }

          .imageWrap {
            margin-bottom: 24px;
            border-radius: 22px;
          }

          .overlayText {
            padding: 0 20px 22px;
          }

          .intro {
            font-size: 17px;
          }

          .signupCard {
            padding: 22px 18px;
            border-radius: 20px;
          }

          .miniTrust {
            flex-direction: column;
            align-items: center;
            gap: 5px;
          }
        }
      `}</style>
    </>
  );
}

export default function BeziehungPage() {
  return (
    <Suspense fallback={null}>
      <BeziehungContent />
    </Suspense>
  );
}
