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
        <section className="hero">
          <div className="logoWrap fadeIn delay1">
            <Image
              src="/IMG_7599.png"
              alt="Poise"
              width={260}
              height={100}
              priority
              className="logo"
            />
          </div>

          <div className="portraitWrap fadeIn delay2">
            <Image
              src="/linda-beziehung.jpg"
              alt="Psychologin Linda Leinweber"
              fill
              priority
              sizes="(max-width: 700px) 92vw, 470px"
              className="portrait"
            />
            <div className="portraitOverlay" />
          </div>

          <div className="eyebrow fadeIn delay3">
            Psychologische Impulse für Beziehungen
          </div>

          <h1 className="fadeIn delay3">
            Mehr Nähe, Verständnis und echte Verbindung in deiner Beziehung
          </h1>

          <p className="lead fadeIn delay4">
            Erhalte fundierte, einfühlsame und alltagstaugliche Impulse zu
            Kommunikation, Bindung, Konflikten und emotionaler Nähe.
          </p>

          <div className="author fadeIn delay4">
            <span className="authorIcon">💛</span>
            <span>
              Von Psychologin <strong>Linda Leinweber</strong>
            </span>
          </div>

          <div className="trustRow fadeIn delay4">
            <div className="trustItem">
              <span className="trustNumber">300.000+</span>
              <span className="trustLabel">Menschen in der Community</span>
            </div>

            <div className="trustDivider" />

            <div className="trustItem">
              <span className="trustNumber">Psychologisch</span>
              <span className="trustLabel">fundiert & verständlich</span>
            </div>
          </div>

          <div className="signupCard fadeIn delay5">
            {!submitted ? (
              <>
                <div className="cardBadge">Kostenlos</div>

                <h2>Deine Beziehungsimpulse per E-Mail</h2>

                <p className="cardIntro">
                  Trage deine E-Mail-Adresse ein und erhalte regelmäßig
                  wertvolle psychologische Impulse direkt in dein Postfach.
                </p>

                <form onSubmit={handleSubmit} noValidate>
                  <label htmlFor="email">E-Mail-Adresse</label>

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
                    aria-label="E-Mail-Adresse"
                  />

                  <button type="submit" disabled={loading}>
                    {loading
                      ? "Wird angemeldet …"
                      : "Kostenlose Beziehungsimpulse erhalten"}
                  </button>

                  <p className="privacy">
                    Mit deiner Anmeldung erhältst du psychologische Impulse,
                    Angebote und Neuigkeiten von Poise per E-Mail. Du kannst
                    dich jederzeit wieder abmelden.
                  </p>
                </form>
              </>
            ) : (
              <div className="success" role="status" aria-live="polite">
                <div className="successIcon">💛</div>
                <h2>Danke für deine Anmeldung!</h2>
                <p>
                  Schau jetzt in dein E-Mail-Postfach. Dort erhältst du in Kürze
                  deine ersten psychologischen Beziehungsimpulse.
                </p>
              </div>
            )}
          </div>

          <div className="benefits">
            <article className="benefitCard">
              <div className="benefitIcon">🧠</div>
              <h3>Psychologisch fundiert</h3>
              <p>
                Verständlich aufbereitetes Wissen statt oberflächlicher Tipps.
              </p>
            </article>

            <article className="benefitCard">
              <div className="benefitIcon">💬</div>
              <h3>Praktisch im Alltag</h3>
              <p>
                Impulse, die du direkt in Gesprächen und Konflikten anwenden
                kannst.
              </p>
            </article>

            <article className="benefitCard">
              <div className="benefitIcon">🌿</div>
              <h3>Einfühlsam erklärt</h3>
              <p>
                Ohne Schuldzuweisungen, Druck oder unrealistische Erwartungen.
              </p>
            </article>
          </div>

          <section className="aboutLinda">
            <div className="aboutText">
              <div className="eyebrow left">Hallo, ich bin Linda</div>
              <h2>Beziehungen dürfen sich sicher, lebendig und verbunden anfühlen.</h2>
              <p>
                Als Psychologin beschäftige ich mich intensiv damit, was
                Menschen in Beziehungen stärkt und was echte Nähe möglich
                macht. In meinen Impulsen verbinde ich psychologisches Wissen
                mit konkreten, alltagstauglichen Gedanken für mehr Verständnis,
                Klarheit und Verbindung.
              </p>
            </div>
          </section>

          <footer>
            <p>
              Die Inhalte ersetzen keine individuelle psychologische Beratung,
              Psychotherapie oder medizinische Behandlung.
            </p>
          </footer>
        </section>
      </main>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          padding: 34px 20px 64px;
          color: #2f2925;
          background:
            radial-gradient(circle at 10% 0%, rgba(234, 215, 202, 0.72), transparent 28%),
            radial-gradient(circle at 90% 12%, rgba(242, 227, 217, 0.72), transparent 25%),
            linear-gradient(180deg, #f8f3ef 0%, #ffffff 45%, #fbf8f5 100%);
          overflow: hidden;
        }

        .hero {
          width: 100%;
          max-width: 740px;
          margin: 0 auto;
          text-align: center;
        }

        .logoWrap {
          margin-bottom: 24px;
        }

        .logo {
          width: auto;
          height: 58px;
          max-width: 82%;
          object-fit: contain;
        }

        .portraitWrap {
          position: relative;
          width: min(100%, 470px);
          aspect-ratio: 4 / 5;
          margin: 0 auto 34px;
          overflow: hidden;
          border-radius: 34px;
          background: #eee6df;
          box-shadow:
            0 22px 60px rgba(66, 49, 39, 0.16),
            0 2px 8px rgba(66, 49, 39, 0.08);
        }

        .portrait {
          object-fit: cover;
          object-position: center;
          transform: scale(1.01);
        }

        .portraitOverlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            transparent 62%,
            rgba(40, 29, 23, 0.12) 100%
          );
          pointer-events: none;
        }

        .eyebrow {
          margin-bottom: 14px;
          color: #927765;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .eyebrow.left {
          margin-bottom: 12px;
          text-align: left;
        }

        h1 {
          max-width: 680px;
          margin: 0 auto 22px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(40px, 7.7vw, 64px);
          font-weight: 500;
          line-height: 1.02;
          letter-spacing: -0.045em;
        }

        .lead {
          max-width: 610px;
          margin: 0 auto;
          color: #675d56;
          font-size: clamp(18px, 3.5vw, 21px);
          line-height: 1.65;
        }

        .author {
          display: inline-flex;
          align-items: center;
          gap: 11px;
          margin: 24px auto 8px;
          color: #5e544d;
          font-size: 16px;
        }

        .authorIcon {
          display: inline-flex;
          width: 38px;
          height: 38px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #efe3da;
          font-size: 18px;
        }

        .trustRow {
          display: flex;
          max-width: 560px;
          align-items: stretch;
          justify-content: center;
          gap: 24px;
          margin: 28px auto 32px;
          padding: 18px 20px;
          border: 1px solid rgba(117, 91, 72, 0.12);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(8px);
        }

        .trustItem {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 4px;
        }

        .trustNumber {
          font-size: 17px;
          font-weight: 800;
        }

        .trustLabel {
          color: #756b64;
          font-size: 13px;
          line-height: 1.35;
        }

        .trustDivider {
          width: 1px;
          background: rgba(117, 91, 72, 0.16);
        }

        .signupCard {
          position: relative;
          margin-top: 10px;
          padding: clamp(26px, 6vw, 42px);
          border: 1px solid rgba(119, 90, 68, 0.13);
          border-radius: 30px;
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 24px 70px rgba(66, 49, 39, 0.12);
          text-align: left;
        }

        .cardBadge {
          display: inline-flex;
          margin-bottom: 16px;
          padding: 7px 12px;
          border-radius: 999px;
          background: #efe3da;
          color: #765d4e;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .signupCard h2,
        .aboutLinda h2 {
          margin: 0 0 12px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(29px, 5vw, 39px);
          font-weight: 500;
          line-height: 1.14;
          letter-spacing: -0.025em;
        }

        .cardIntro {
          margin: 0 0 24px;
          color: #70655e;
          font-size: 16px;
          line-height: 1.6;
        }

        label {
          display: block;
          margin-bottom: 9px;
          font-size: 14px;
          font-weight: 700;
        }

        input {
          width: 100%;
          padding: 17px 18px;
          border: 1px solid #d8cec6;
          border-radius: 15px;
          outline: none;
          background: #fff;
          color: #2f2925;
          font: inherit;
          font-size: 16px;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease;
        }

        input:focus {
          border-color: #8d6e5b;
          box-shadow: 0 0 0 4px rgba(141, 110, 91, 0.12);
        }

        button {
          width: 100%;
          margin-top: 14px;
          padding: 18px 20px;
          border: none;
          border-radius: 15px;
          background: #2f2925;
          color: #fff;
          font: inherit;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(47, 41, 37, 0.18);
          transition:
            transform 0.18s ease,
            opacity 0.18s ease,
            box-shadow 0.18s ease;
        }

        button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 14px 28px rgba(47, 41, 37, 0.22);
        }

        button:active:not(:disabled) {
          transform: translateY(0);
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.62;
        }

        .privacy {
          margin: 15px 0 0;
          color: #857970;
          font-size: 12px;
          line-height: 1.55;
          text-align: center;
        }

        .success {
          padding: 10px 0;
          text-align: center;
        }

        .successIcon {
          margin-bottom: 12px;
          font-size: 46px;
        }

        .success p {
          margin: 0;
          color: #6d625a;
          font-size: 17px;
          line-height: 1.6;
        }

        .benefits {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 24px;
        }

        .benefitCard {
          padding: 22px 18px;
          border: 1px solid rgba(119, 90, 68, 0.1);
          border-radius: 21px;
          background: rgba(255, 255, 255, 0.72);
          text-align: left;
        }

        .benefitIcon {
          margin-bottom: 12px;
          font-size: 25px;
        }

        .benefitCard h3 {
          margin: 0 0 8px;
          font-size: 16px;
        }

        .benefitCard p {
          margin: 0;
          color: #746a63;
          font-size: 14px;
          line-height: 1.5;
        }

        .aboutLinda {
          margin-top: 42px;
          padding: clamp(28px, 6vw, 44px);
          border-radius: 28px;
          background: #efe5dd;
          text-align: left;
        }

        .aboutLinda p {
          margin: 0;
          color: #665d56;
          font-size: 17px;
          line-height: 1.7;
        }

        footer {
          max-width: 560px;
          margin: 28px auto 0;
        }

        footer p {
          margin: 0;
          color: #8b8179;
          font-size: 12px;
          line-height: 1.55;
        }

        .fadeIn {
          opacity: 0;
          animation: fadeUp 0.8s ease forwards;
        }

        .delay1 {
          animation-delay: 0.05s;
        }

        .delay2 {
          animation-delay: 0.15s;
        }

        .delay3 {
          animation-delay: 0.25s;
        }

        .delay4 {
          animation-delay: 0.35s;
        }

        .delay5 {
          animation-delay: 0.45s;
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 720px) {
          .page {
            padding: 24px 15px 48px;
          }

          .logo {
            height: 52px;
          }

          .portraitWrap {
            width: 100%;
            border-radius: 26px;
          }

          .trustRow {
            gap: 15px;
            padding: 16px 14px;
          }

          .benefits {
            grid-template-columns: 1fr;
          }

          .benefitCard {
            text-align: center;
          }

          .signupCard {
            border-radius: 24px;
          }
        }

        @media (max-width: 440px) {
          h1 {
            font-size: 39px;
          }

          .lead {
            font-size: 18px;
          }

          .trustRow {
            flex-direction: column;
          }

          .trustDivider {
            width: 100%;
            height: 1px;
          }

          .trustItem {
            align-items: center;
          }

          .author {
            font-size: 15px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .fadeIn {
            opacity: 1;
            animation: none;
          }

          button {
            transition: none;
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
