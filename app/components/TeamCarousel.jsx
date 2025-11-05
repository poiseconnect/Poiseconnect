"use client";
import { useState } from "react";
import Image from "next/image";

export default function TeamCarousel({ members, onSelect }) {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleOpen = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div style={{ overflowX: "auto", whiteSpace: "nowrap", paddingBottom: "1rem" }}>
      {members.map((m, index) => (
        <div
          key={m.name}
          style={{
            display: "inline-block",
            width: "300px",
            marginRight: "18px",
            verticalAlign: "top",
            background: "#fff",
            borderRadius: "24px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.08)",
            padding: "1.2rem",
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <Image
            src={m.image}
            width={260}
            height={260}
            style={{ borderRadius: "20px", objectFit: "cover" }}
            alt={m.name}
          />

          <h3 style={{ marginTop: "1rem", fontSize: "1.25rem", fontWeight: "600" }}>
            {m.name}
          </h3>

          <p style={{ fontSize: "0.9rem", opacity: 0.8 }}>{m.role}</p>

          {/* Button: Mehr anzeigen / Weniger */}
          <button
            onClick={() => toggleOpen(index)}
            style={{
              marginTop: "10px",
              background: "transparent",
              border: "none",
              color: "#A27C77",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {openIndex === index ? "Weniger anzeigen" : "Mehr erfahren"}
          </button>

          {/* EXPANDED SECTION */}
          {openIndex === index && (
            <div style={{ marginTop: "1.1rem", textAlign: "left" }}>
              <p style={{ fontSize: "0.95rem", lineHeight: "1.4" }}>
                {m.bio}
              </p>

              {m.video && (
                <div style={{ marginTop: "1rem", borderRadius: "14px", overflow: "hidden" }}>
                  <video width="100%" controls style={{ borderRadius: "14px" }}>
                    <source src={m.video} type="video/mp4" />
                  </video>
                </div>
              )}

              <button
                onClick={() => onSelect(m.name)}
                style={{
                  marginTop: "1.2rem",
                  width: "100%",
                  background: "#D7A6A0",
                  color: "#fff",
                  border: "none",
                  padding: "0.8rem",
                  borderRadius: "14px",
                  fontSize: "1rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Diesen Weg gemeinsam gehen
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
