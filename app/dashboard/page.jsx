"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Neue Stati
const STATUS_LABELS = {
  FIRST_MEETING_SCHEDULED: "Erstgespräch geplant",
  ACTIVE: "Begleitung aktiv",
  NO_MATCH: "Kein Match",
  FINISHED: "Abgeschlossen",
};

// Farben
const STATUS_COLORS = {
  FIRST_MEETING_SCHEDULED: { bg: "#EFF3FF", border: "#9AAAF5", text: "#304085" },
  ACTIVE: { bg: "#EAF8EF", border: "#9AD0A0", text: "#2F6E3A" },
  NO_MATCH: { bg: "#FEECEC", border: "#F1A5A5", text: "#8B1E2B" },
  FINISHED: { bg: "#F9F5FF", border: "#C8B0F5", text: "#54358B" },
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [matchModal, setMatchModal] = useState(null); // Anfrage für Match
  const [sessionModal, setSessionModal] = useState(null); // Anfrage für neue Sitzung

  // Stundensatz + Sitzung für Modals
  const [tarif, setTarif] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionDuration, setSessionDuration] = useState(60);

  // ---------------------------
  // 1) Login laden
  // ---------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  // ---------------------------
  // 2) Anfragen laden
  // ---------------------------
  useEffect(() => {
    if (!user?.email) return;

    async function load() {
      setLoading(true);

      // Jede/r Therapeut:in sieht nur eigene Klient:innen
      const { data, error } = await supabase
        .from("anfragen")
        .select("*")
        .eq("therapist_email", user.email)
        .order("id", { ascending: false });

      if (!error) setRequests(data || []);
      setLoading(false);
    }

    load();
  }, [user]);

  // -----------------------------------
  // API: NO MATCH
  // -----------------------------------
  async function noMatch(req) {
    const res = await fetch("/api/no-match", {
      method: "POST",
      body: JSON.stringify({ anfrageId: req.id }),
    });

    if (res.ok) {
      alert("Anfrage wurde als 'Kein Match' beendet.");
      window.location.reload();
    }
  }

  // -----------------------------------
  // API: MATCH
  // -----------------------------------
  async function saveMatch() {
    if (!matchModal) return;

    if (!tarif || !sessionDate) {
      alert("Bitte Tarif und nächsten Termin eingeben.");
      return;
    }

    const res = await fetch("/api/match-client", {
      method: "POST",
      body: JSON.stringify({
        anfrageId: matchModal.id,
        honorar: Number(tarif),
        therapistEmail: user.email,
        nextDate: sessionDate,
        duration: sessionDuration,
      }),
    });

    if (res.ok) {
      alert("Begleitung gestartet!");
      setMatchModal(null);
      setTarif("");
      setSessionDate("");
      window.location.reload();
    } else {
      alert("Fehler beim Start der Begleitung");
    }
  }

  // -----------------------------------
  // API: Sitzung hinzufügen
  // -----------------------------------
  async function saveSession() {
    if (!sessionModal) return;

    if (!sessionDate) {
      alert("Bitte Datum wählen.");
      return;
    }

    const res = await fetch("/api/add-session", {
      method: "POST",
      body: JSON.stringify({
        anfrageId: sessionModal.id,
        therapist: user.email,
        date: sessionDate,
        duration: sessionDuration,
      }),
    });

    if (res.ok) {
      alert("Sitzung gespeichert!");
      setSessionModal(null);
      setSessionDate("");
      window.location.reload();
    }
  }

  // -----------------------------------
  // API: Coaching beenden
  // -----------------------------------
  async function finishCoaching(req) {
    const res = await fetch("/api/finish-coaching", {
      method: "POST",
      body: JSON.stringify({ anfrageId: req.id }),
    });

    if (res.ok) {
      alert("Coaching beendet.");
      window.location.reload();
    }
  }

  // -----------------------------
  // UI Rendering
  // -----------------------------
  if (!user)
    return <div style={{ padding: 40 }}>Bitte einloggen…</div>;

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
      <h1>Poise Dashboard</h1>

      {loading && <p>Wird geladen…</p>}

      {!loading &&
        requests.map((r) => {
          const status = r.status || "FIRST_MEETING_SCHEDULED";
          const colors = STATUS_COLORS[status];

          return (
            <article
              key={r.id}
              style={{
                padding: 20,
                marginBottom: 16,
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                background: colors.bg,
              }}
            >
              <h3>
                {r.vorname} {r.nachname}
              </h3>
              <p>{r.email}</p>

              {/* STATUS BADGE */}
              <div
                style={{
                  display: "inline-flex",
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "#fff",
                  border: `1px solid ${colors.border}`,
                  marginBottom: 12,
                }}
              >
                <span style={{ color: colors.text }}>
                  {STATUS_LABELS[status]}
                </span>
              </div>

              {/* ----------------------------------------------------
                PHASE 1: Erstgespräch – nur anzeigen, wenn noch nicht ACTIVE
              ---------------------------------------------------- */}
              {status === "FIRST_MEETING_SCHEDULED" && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => confirmAppointment(r)}>
                    ✔ Termin bestätigen
                  </button>

                  <button onClick={() => decline(r)}>✖ Absagen</button>

                  <button onClick={() => newAppointment(r)}>
                    🔁 Neuer Termin
                  </button>

                  <button onClick={() => reassign(r)}>
                    👥 anderes Team
                  </button>

                  {/* MATCH / NO MATCH */}
                  <button onClick={() => setMatchModal(r)}>
                    💚 Match
                  </button>

                  <button onClick={() => noMatch(r)}>❌ No Match</button>
                </div>
              )}

              {/* ----------------------------------------------------
                PHASE 2: Aktive Begleitung
              ---------------------------------------------------- */}
              {status === "ACTIVE" && (
                <div style={{ marginTop: 10 }}>
                  <p>
                    <strong>Tarif:</strong>{" "}
                    {r.honorar_klient
                      ? r.honorar_klient + " € / h"
                      : "Kein Tarif gespeichert"}
                  </p>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setSessionModal(r)}>
                      ➕ nächste Sitzung
                    </button>

                    <button
                      onClick={() => finishCoaching(r)}
                      style={{ background: "#FDD" }}
                    >
                      🔴 Coaching beendet
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}

      {/* ------------------------------------------------------
         MATCH MODAL
      ------------------------------------------------------ */}
      {matchModal && (
        <div style={modalStyle}>
          <div style={modalInner}>
            <h3>Begleitung starten</h3>

            <label>Stundensatz (€)</label>
            <input
              value={tarif}
              onChange={(e) => setTarif(e.target.value)}
            />

            <label>Nächster Termin</label>
            <input
              type="datetime-local"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />

            <label>Dauer (Minuten)</label>
            <select
              value={sessionDuration}
              onChange={(e) => setSessionDuration(Number(e.target.value))}
            >
              <option value={50}>50 Minuten</option>
              <option value={60}>60 Minuten</option>
              <option value={75}>75 Minuten</option>
            </select>

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button onClick={saveMatch}>Speichern</button>
              <button onClick={() => setMatchModal(null)}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------
         SESSION MODAL
      ------------------------------------------------------ */}
      {sessionModal && (
        <div style={modalStyle}>
          <div style={modalInner}>
            <h3>Nächste Sitzung</h3>

            <label>Datum</label>
            <input
              type="datetime-local"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />

            <label>Dauer</label>
            <select
              value={sessionDuration}
              onChange={(e) => setSessionDuration(Number(e.target.value))}
            >
              <option value={50}>50 Minuten</option>
              <option value={60}>60 Minuten</option>
              <option value={75}>75 Minuten</option>
            </select>

            <div style={{ marginTop: 12 }}>
              <button onClick={saveSession}>Speichern</button>
              <button onClick={() => setSessionModal(null)}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalStyle = {
  position: "fixed",
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.3)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const modalInner = {
  background: "#fff",
  padding: 20,
  borderRadius: 12,
  minWidth: 300,
};
