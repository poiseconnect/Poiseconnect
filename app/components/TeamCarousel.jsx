"use client";

import { useEffect, useRef, useState } from "react";

export default function TeamCarousel({ members, onSelect }) {
  const carouselRef = useRef(null);

  const [openIndex, setOpenIndex] = useState(null);
  const [videoIndex, setVideoIndex] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);

  const toggleOpen = (i) => {
    setOpenIndex((current) => (current === i ? null : i));
  };

  const openVideo = (i) => setVideoIndex(i);
  const closeVideo = () => setVideoIndex(null);

  // Bei einer neuen Mitgliederliste wieder am Anfang beginnen
  useEffect(() => {
    setActiveIndex(0);
    setOpenIndex(null);
    setVideoIndex(null);
    setHasScrolled(false);

    if (carouselRef.current) {
      carouselRef.current.scrollLeft = 0;
    }
  }, [members]);

  function handleScroll() {
    const carousel = carouselRef.current;
    if (!carousel) return;

    if (carousel.scrollLeft > 8) {
      setHasScrolled(true);
    }

    const cards = Array.from(
      carousel.querySelectorAll("[data-carousel-card]")
    );

    if (cards.length === 0) return;

    const carouselLeft = carousel.getBoundingClientRect().left;

    let closestIndex = 0;
    let smallestDistance = Infinity;

    cards.forEach((card, index) => {
      const cardLeft = card.getBoundingClientRect().left;
      const distance = Math.abs(cardLeft - carouselLeft);

      if (distance < smallestDistance) {
        smallestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  }

  function scrollToCard(index) {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const cards = carousel.querySelectorAll("[data-carousel-card]");
    const card = cards[index];

    if (!card) return;

    card.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
  }

  if (!Array.isArray(members) || members.length === 0) {
    return (
      <p style={{ opacity: 0.7 }}>
        Aktuell keine Profile verfügbar.
      </p>
    );
  }

  const showNavigation = members.length > 1;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
      }}
    >
      {/* Swipe-Hinweis */}
      {showNavigation && !hasScrolled && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 12,
            color: "#7A5350",
            fontSize: 14,
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            ←
          </span>

          <span>Wische, um weitere Profile zu entdecken</span>
        </div>
      )}

      <div
        style={{
          position: "relative",
          width: "100%",
        }}
      >
        {/* Karten-Slider */}
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="team-carousel-scroll"
          style={{
            display: "flex",
            gap: 14,
            width: "100%",
            overflowX: "auto",
            overflowY: "visible",
            padding: "4px 40px 22px 2px",
            scrollSnapType: "x mandatory",
            scrollPaddingLeft: 2,
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorX: "contain",
          }}
        >
          {members.map((m, i) => (
            <article
              data-carousel-card
              key={m?.id || m?.name || `member-${i}`}
              style={{
                flex: "0 0 min(86%, 300px)",
                minWidth: 0,
                scrollSnapAlign: "start",
                scrollSnapStop: "always",
                background: "#fff",
                borderRadius: 18,
                boxShadow: "0 8px 28px rgba(0,0,0,0.08)",
                padding: "1.2rem",
                textAlign: "center",
                whiteSpace: "normal",
              }}
            >
              <img
                src={m.image}
                alt={m.name}
                loading={i === 0 ? "eager" : "lazy"}
                style={{
                  display: "block",
                  borderRadius: 12,
                  objectFit: "cover",
                  width: "100%",
                  height: 260,
                }}
              />

              <h3
                style={{
                  marginTop: 12,
                  marginBottom: 0,
                  fontSize: "1.1rem",
                  fontWeight: 600,
                }}
              >
                {m.name}
              </h3>

              {m.role && (
                <p
                  style={{
                    fontSize: ".92rem",
                    opacity: 0.8,
                    marginTop: 4,
                    marginBottom: 0,
                    lineHeight: 1.3,
                    overflowWrap: "anywhere",
                  }}
                >
                  {m.role}
                </p>
              )}

              {m.short && (
                <p
                  style={{
                    fontSize: ".95rem",
                    marginTop: 8,
                    marginBottom: 0,
                    lineHeight: 1.4,
                    overflowWrap: "anywhere",
                  }}
                >
                  {m.short}
                </p>
              )}

              <button
                type="button"
                onClick={() => toggleOpen(i)}
                aria-expanded={openIndex === i}
                style={{
                  marginTop: 12,
                  background: "transparent",
                  border: "none",
                  color: "#A27C77",
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: "6px 8px",
                }}
              >
                {openIndex === i
                  ? "Weniger anzeigen"
                  : "Mehr erfahren"}
              </button>

              {openIndex === i && (
                <div
                  style={{
                    marginTop: 12,
                    textAlign: "left",
                  }}
                >
                  {m.long && (
                    <p
                      style={{
                        fontSize: ".95rem",
                        lineHeight: 1.55,
                        marginTop: 0,
                        marginBottom: 14,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {m.long}
                    </p>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      gap: 8,
                    }}
                  >
                    {m.video && (
                      <button
                        type="button"
                        onClick={() => openVideo(i)}
                        style={{
                          background: "#E9D7D4",
                          color: "#7A5350",
                          border: "none",
                          padding: ".8rem",
                          borderRadius: 14,
                          fontSize: ".95rem",
                          cursor: "pointer",
                          fontWeight: 600,
                          width: "100%",
                        }}
                      >
                        Vorstellungs-Video ansehen
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelect(m)}
                      style={{
                        background: "#D7A6A0",
                        color: "#fff",
                        border: "none",
                        padding: ".9rem",
                        borderRadius: 14,
                        fontSize: "1rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        width: "100%",
                      }}
                    >
                      Diese Begleitung wählen
                    </button>
                  </div>
                </div>
              )}

              {videoIndex === i && (
                <VideoModal
                  url={m.video}
                  onClose={closeVideo}
                />
              )}
            </article>
          ))}
        </div>

        {/* Rechter Verlauf als zusätzlicher Hinweis */}
        {showNavigation && activeIndex < members.length - 1 && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 22,
              width: 38,
              zIndex: 2,
              pointerEvents: "none",
              background:
                "linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.92))",
              borderRadius: "0 18px 18px 0",
            }}
          />
        )}
      </div>

      {/* Seitenindikator */}
      {showNavigation && (
        <div
          aria-label={`Profil ${activeIndex + 1} von ${members.length}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            marginTop: 2,
          }}
        >
          {members.map((member, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                type="button"
                key={member?.id || member?.name || `dot-${index}`}
                onClick={() => scrollToCard(index)}
                aria-label={`Profil ${index + 1} anzeigen`}
                aria-current={isActive ? "true" : undefined}
                style={{
                  width: isActive ? 20 : 8,
                  height: 8,
                  padding: 0,
                  border: "none",
                  borderRadius: 999,
                  background: isActive ? "#A27C77" : "#D9D0CE",
                  cursor: "pointer",
                  transition:
                    "width 180ms ease, background 180ms ease",
                }}
              />
            );
          })}
        </div>
      )}

      <style jsx>{`
        .team-carousel-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .team-carousel-scroll::-webkit-scrollbar {
          display: none;
        }

        @media (min-width: 720px) {
          .team-carousel-scroll {
            padding-right: 48px !important;
          }
        }
      `}</style>
    </div>
  );
}

function VideoModal({ url, onClose }) {
  if (!url) return null;

  const id =
    url.match(
      /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([^&?/]+)/
    )?.[1] || "";

  const embed = id
    ? `https://www.youtube.com/embed/${id}`
    : url;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vorstellungsvideo"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 640,
          background: "#fff",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Video schließen"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 2,
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
            fontSize: 22,
            cursor: "pointer",
          }}
        >
          ×
        </button>

        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
          }}
        >
          <iframe
            src={embed}
            title="Vorstellungsvideo"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: 0,
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
