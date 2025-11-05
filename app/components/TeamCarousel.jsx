"use client";
import { useState } from "react";

export default function TeamCarousel({ members, onSelect }) {
  const [openIndex, setOpenIndex] = useState(null);
  const toggleOpen = (i) => setOpenIndex(openIndex === i ? null : i);

  if (!Array.isArray(members) || members.length === 0) {
    return <p style={{ opacity: 0.7 }}>Aktuell keine Profile verfügbar.</p>;
  }

  return (
    <div style={{ overflowX: "auto", whiteSpace: "nowrap", paddingBottom: "1rem" }}>
      {members.map((m, i) => (
        <div
          key={`${m.name}-${i}`}
          style={{
            display: "inline-block",
            width: 300,
            marginRight: 18,
            verticalAlign: "top",
            background: "#fff",
            borderRadius: 24,
            boxShadow: "0 8px 28px rgba(0,0,0,0.08)",
            padding: "1.2rem",
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <img
            src={m.image}
            alt={m.name}
            width={260}
            height={260}
            style={{ borderRadius: 20, objectFit: "cover", width: "100%", height: 260 }}
          />

          <h3 style={{ marginTop: 12, fontSize: "1.1rem", fontWeight: 600 }}>{m.name}</h3>

          {m.role && (
            <p style={{ fontSize: ".92rem", opacity: 0.8, marginTop: 2 }}>{m.role}</p>
          )}

          {m.short && (
            <p style={{ fontSize: ".95rem", marginTop: 6, lineHeight: 1.4 }}>{m.short}</p>
          )}

          <button
            onClick={() => toggleOpen(i)}
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
            <div style={{ marginTop: 12, textAlign: "left" }}>
              {m.bio && (
                <p style={{ fontSize: ".95rem", lineHeight: 1.55, whiteSpace: "normal" }}>
                  {m.bio}
                </p>
              )}

              {m.video && (
                <div style={{ marginTop: 12, borderRadius: 14, overflow: "hidden" }}>
                  <SmartVideo url={m.video} />
                </div>
              )}

              <button
                onClick={() => onSelect(m.name)}
                style={{
                  marginTop: 14,
                  width: "100%",
                  background: "#D7A6A0",
                  color: "#fff",
                  border: "none",
                  padding: ".9rem",
                  borderRadius: 14,
                  fontSize: "1rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Diese Begleitung wählen
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SmartVideo({ url }) {
  const u = (url || "").trim();
  if (!u) return null;

  const isYouTube = /youtube\.com|youtu\.be/.test(u);
  const isVimeo = /vimeo\.com/.test(u);
  const isMp4 = /\.mp4(\?|$)/i.test(u);

  if (isYouTube) {
    const id =
      u.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1] ||
      u.split("v=")[1]?.split("&")[0] ||
      "";
    const src = `https://www.youtube.com/embed/${id}`;
    return (
      <iframe
        src={src}
        title="Video"
        style={{ width: "100%", height: 220, border: 0 }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture;"
        allowFullScreen
      />
    );
  }

  if (isVimeo) {
    const id = u.match(/vimeo\.com\/(\d+)/)?.[1] || "";
    const src = `https://player.vimeo.com/video/${id}`;
    return (
      <iframe
        src={src}
        title="Video"
        style={{ width: "100%", height: 220, border: 0 }}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (isMp4) {
    return (
      <video controls style={{ width: "100%", display: "block" }}>
        <source src={u} type="video/mp4" />
      </video>
    );
  }

  // Fallback
  return (
    <a href={u} target="_blank" rel="noreferrer" style={{ color: "#A27C77" }}>
      Video öffnen
    </a>
  );
}
