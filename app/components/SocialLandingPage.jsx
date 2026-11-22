"use client";

import Image from "next/image";
import { Suspense } from "react";

function SocialLandingPageContent({ topic }) {
  return (
    <>
      <main className="page">
        <section className="content">
          <div className="logoWrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={topic.logo.src} alt={topic.logo.alt} className="logo" />
          </div>

          <div className="imageWrap">
            <Image
              src={topic.image.src}
              alt={topic.image.alt}
              fill
              priority
              quality={78}
              sizes="(max-width: 700px) 94vw, 520px"
              className="portrait"
              style={{
                objectFit: "cover",
                objectPosition: topic.image.objectPosition,
              }}
            />
            <div className="scrim" />
            <div className="overlayText">
              <p className="eyebrow">{topic.eyebrow}</p>
              <h1>{topic.headline}</h1>
            </div>
          </div>

          <p className="intro">{topic.intro}</p>

          <p className="note">{topic.note}</p>
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

        }
      `}</style>
    </>
  );
}

export default function SocialLandingPage({ topic }) {
  return (
    <Suspense fallback={null}>
      <SocialLandingPageContent topic={topic} />
    </Suspense>
  );
}