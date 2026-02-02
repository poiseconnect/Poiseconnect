"use client";
import { useState } from "react";

export default function TeamCarousel({ members, onSelect }) {
  const [openIndex, setOpenIndex] = useState(null);
  const [videoIndex, setVideoIndex] = useState(null);

  const toggleOpen = (i) => setOpenIndex(openIndex === i ? null : i);
  const openVideo = (i) => setVideoIndex(i);
  const closeVideo = () => setVideoIndex(null);

  if (!Array.isArray(members) || members.length === 0) {
    return <p style={{ opacity: 0.7 }}>Aktuell keine Profile verfügbar.</p>;
  }

  return (
    <div style={{ overflowX: "auto", whiteSpace: "nowrap", paddingBottom: "1rem" }}>
      {members.map((m, i) => (
        <div
          // ✅ WICHTIG: stabiler Key (ohne Index), damit Sortierung sichtbar wird
          key={m?.name || `member-${i}`}
          style={{
            display: "inline-block",
            width: 300,
            marginRight: 18,
            verticalAlign: "top",
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
            style={{
              borderRadius: 12,
              objectFit: "cover",
              width: "100%",
              height: 260,
            }}
          />

          <h3 style={{ marginTop: 12, fontSize: "1.1rem", fontWeight: 600 }}>
            {m.name}
          </h3>

          {m.role && (
            <p
              style={{
                fontSize: ".92rem",
                opacity: 0.8,
                marginTop: 2,
                lineHeight: 1.3,
                wordBreak: "break-word",
              }}
            >
              {m.role}
            </p>
          )}

          {m.short && (
            <p
              style={{
                fontSize: ".95rem",
                marginTop: 6,
                lineHeight: 1.4,
                wordBreak: "break-word",
              }}
            >
              {m.short}
            </p>
          )}

          <button
            onClick={() => toggleOpen(i)} // ✅ i existiert, weil map((m, i) ...)
            style={{
              marginTop: 10,
              background: "transparent",
              border: "none",
              color: "#A27C77",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {openIndex === i ? "Weniger anzeigen" : "Mehr erfahren"}
          </button>

          {openIndex === i && (
            <div style={{ marginTop: 14, textAlign: "left" }}>
              {m.long && (
                <p
                  style={{
                    fontSize: ".95rem",
                    lineHeight: 1.55,
                    marginBottom: 14,
                    wordBreak: "break-word",
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
                    onClick={() => openVideo(i)} // ✅ i existiert
                    style={{
                      background: "#E9D7D4",
                      color: "#7A5350",
                      border: "none",
                      padding: ".8rem",
                      borderRadius: 14,
                      fontSize: ".95rem",
                      cursor: "pointer",
                      fontWeight: 500,
                      width: "100%",
                    }}
                  >
                    Vorstellungs-Video ansehen
                  </button>
                )}

                <button
                  onClick={() => onSelect(m)}
                  style={{
                    background: "#D7A6A0",
                    color: "#fff",
                    border: "none",
                    padding: ".9rem",
                    borderRadius: 14,
                    fontSize: "1rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Diese Begleitung wählen
                </button>
              </div>
            </div>
          )}

          {videoIndex === i && <VideoModal url={m.video} onClose={closeVideo} />}
        </div>
      ))}
    </div>
  );
}

function VideoModal({ url, onClose }) {
  if (!url) return null;

  const id = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1] || "";
  const embed = id ? `https://www.youtube.com/embed/${id}` : url;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          background: "#fff",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <iframe
          src={embed}
          width="100%"
          height="360"
          style={{ border: 0 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
