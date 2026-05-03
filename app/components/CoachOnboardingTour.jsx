"use client";

import { useEffect, useState } from "react";

const TOUR_STEPS = [
  {
    title: "Willkommen bei Poise Connect 🤍",
    text: "Ich zeige dir kurz die wichtigsten Bereiche, damit du direkt starten kannst.",
  },
  {
    title: "Unbearbeitet",
    text: "Hier findest du neue Anfragen, die noch geprüft oder beantwortet werden müssen.",
  },
  {
    title: "Erstgespräch",
    text: "Hier landen bestätigte Erstgespräche. Nach dem Gespräch entscheidest du, ob ein Match entsteht.",
  },
  {
    title: "Aktiv",
    text: "Hier verwaltest du laufende Klient:innen und trägst Sitzungen ein.",
  },
  {
    title: "Abrechnung",
    text: "Hier findest du deine Sitzungen, Umsätze und Rechnungsinformationen.",
  },
  {
    title: "Einstellungen",
    text: "Bitte trage hier deinen Meeting-Link, deine Verfügbarkeit und dein Profil ein.",
  },
  {
    title: "Fertig 🎉",
    text: "Du kannst das Tutorial jederzeit erneut starten, wenn du Hilfe brauchst.",
  },
];

export default function CoachOnboardingTour({ forceOpen = false }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const done = localStorage.getItem("poise_coach_tour_done");

    if (forceOpen || done !== "true") {
      setOpen(true);
      setStep(0);
    }
  }, [forceOpen]);

  function closeTour() {
    localStorage.setItem("poise_coach_tour_done", "true");
    setOpen(false);
  }

  function nextStep() {
    if (step >= TOUR_STEPS.length - 1) {
      closeTour();
      return;
    }

    setStep((s) => s + 1);
  }

  function prevStep() {
    setStep((s) => Math.max(0, s - 1));
  }

  if (!open) return null;

  const current = TOUR_STEPS[step];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#fff",
          borderRadius: 22,
          padding: 26,
          boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
          fontFamily: "inherit",
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "#777",
            marginBottom: 8,
          }}
        >
          Schritt {step + 1} von {TOUR_STEPS.length}
        </div>

        <h2 style={{ marginTop: 0, marginBottom: 10 }}>
          {current.title}
        </h2>

        <p style={{ lineHeight: 1.55, color: "#333", fontSize: 15 }}>
          {current.text}
        </p>

        <div
          style={{
            height: 8,
            background: "#eee",
            borderRadius: 999,
            overflow: "hidden",
            marginTop: 20,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${((step + 1) / TOUR_STEPS.length) * 100}%`,
              background: "#111",
              transition: "width 0.25s ease",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            marginTop: 24,
          }}
        >
          <button
            type="button"
            onClick={closeTour}
            style={{
              border: "none",
              background: "transparent",
              color: "#666",
              cursor: "pointer",
            }}
          >
            Überspringen
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && (
              <button
                type="button"
                onClick={prevStep}
                style={{
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Zurück
              </button>
            )}

            <button
              type="button"
              onClick={nextStep}
              style={{
                padding: "10px 16px",
                borderRadius: 999,
                border: "none",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {step >= TOUR_STEPS.length - 1 ? "Fertig" : "Weiter"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
