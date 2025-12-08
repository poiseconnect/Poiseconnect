"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// -------------------------------
// STATUS DEFINITIONS (REAL)
// -------------------------------
const STATUS_LABELS = {
  neu: "Neu",
  termin_bestaetigt: "Termin bestätigt",
  termin_neu: "Neuer Termin",
  weitergeleitet: "Weitergeleitet",
  active: "Begleitung aktiv",
  no_match: "Kein Match",
  finished: "Abgeschlossen",
};

const STATUS_COLORS = {
  neu: { bg: "#FFF7EC", border: "#E3C29A", text: "#8B5A2B" },
  termin_bestaetigt: { bg: "#EAF8EF", border: "#9AD0A0", text: "#2F6E3A" },
  termin_neu: { bg: "#EFF3FF", border: "#9AAAF5", text: "#304085" },
  weitergeleitet: { bg: "#F9F5FF", border: "#C8B0F5", text: "#54358B" },
  active: { bg: "#E2F7F0", border: "#79C2A1", text: "#1E6348" },
  no_match: { bg: "#FDECEC", border: "#F2A6A6", text: "#8B1E2B" },
  finished: { bg: "#EEEAFD", border: "#B6A6F2", text: "#3B2D7A" },
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // MATCH MODAL
  const [matchModal, setMatchModal] = useState(null);
  const [tarif, setTarif] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionDuration, setSessionDuration] = useState(60);

  // SESSION MODAL
  const [sessionModal, setSessionModal] = useState(null);

  // -------------------------------
  // 1) USER LADEN
  // -------------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  // -------------------------------
  // 2) ANFRAGEN LADEN
  // -------------------------------
  useEffect(() => {
    if (!user?.email) return;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("anfragen")
        .select("*")
        .eq("therapist_email", user.email)
        .order("id", { ascending: false });

      if (!error) setRequests(data);
      setLoading(false);
    }

    load();
  }, [user]);

  // ------------------------------------------
  // API: NO MATCH
  // ------------------------------------------
  async function noMatch(req) {
    const res = await fetch("/api/no-match", {
      method: "POST",
      body: JSON.stringify({ anfrageId: req.id }),
    });

    if (res.ok) {
      alert("Kein Match gespeichert.");
      window.location.reload();
    }
  }

  // ------------------------------------------
  // API: MATCH (BEGIN COACHING)
  // ------------------------------------------
  async function saveMatch() {
    if (!tarif || !sessionDate) {
      alert("Bitte Tarif und ersten Termin eingeben.");
      return;
    }

    const res = await fetch("/api/match-client", {
      method: "POST",
      body: JSON.stringify({
        anfrageId: matchModal.id,
        honorar_klient: Number(tarif),
        therapistEmail: user.email,
        nextDate: sessionDate,
        duration: sessionDuration,
      }),
    });

    if (!res.ok) {
      alert("Fehler bei MATCH.");
      return;
    }

    alert("Match erfolgreich – Coaching gestartet.");
    setMatchModal(null);
    setTarif("");
    setSessionDate("");
    window.location.reload();
  }

  // ------------------------------------------
  // API: Neue Sitzung speichern
  // ------------------------------------------
  async function saveSession() {
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

    if (!res.ok) {
      alert("Fehler beim Speichern der Sitzung.");
      return;
    }

    alert("Sitzung gespeichert.");
    setSessionModal(null);
    setSessionDate("");
    window.location.reload();
  }

  // ------------------------------------------
  // API: Coaching beenden
  // ------------------------------------------
  async function finishCoaching(req) {
    const res = await fetch("/api/finish-coaching", {
      method: "POST",
      body: JSON.stringify({ anfrageId: req.id }),
    });

    if (!res.ok) {
      alert("Fehler beim Beenden.");
      return;
    }

    alert("Coaching beendet.");
    window.location.reload();
  }

  // ------------------------------------------
  // DASHBOARD UI
  // ------------------------------------------
  if (!user)
    return <div style={{ padding: 40 }}>Bitte einloggen…</div>;

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
      <h1>Poise Dashboard</h1>

      {loading && <p>Wird geladen…</p>}

      {!loading &&
        requests.map((r) => {
          const colors = STATUS_COLORS[r.status] || STATUS_COLORS["neu"];

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
                  {STATUS_LABELS[r.status] || "?"}
                </span>
              </div>

              {/* ---------------------------------------------
                  PHASE: ERSTGESPRÄCH (solange NICHT active/no_match/finished)
              --------------------------------------------- */}
              {["neu", "termin_neu", "termin_bestaetigt", "weitergeleitet"].includes(r.status) && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => confirmAppointment(r)}>
                    ✔ Termin bestätigen
                  </button>

                  <button onClick={() => decline(r)}>✖ Absagen</button>

                  <button onClick={() => newAppointment(r)}>
                    🔁 Neuer Termin
                  </button>

                  <button onClick={() => reassign(r)}>
                    👥 Weiterleiten
                  </button>

                  {/* NEW: MATCH */}
                  <button onClick={() => setMatchModal(r)}>💚 Match</button>

                  {/* NEW: NO MATCH */}
                  <button onClick={() => noMatch(r)}>❌ No Match</button>
                </div>
              )}

              {/* ---------------------------------------------
                  PHASE: COACHING (active)
              --------------------------------------------- */}
              {r.status === "active" && (
                <div style={{ marginTop: 10 }}>
                  <p>
                    <strong>Tarif: </strong>
                    {r.honorar_klient} € / Stunde
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

              {/* ---------------------------------------------
                  PHASE: ABGESCHLOSSEN
              --------------------------------------------- */}
              {r.status === "finished" && (
                <p style={{ marginTop: 10, fontStyle: "italic" }}>
                  Coaching abgeschlossen.
                </p>
              )}

              {r.status === "no_match" && (
                <p style={{ marginTop: 10, color: "#a33" }}>
                  Kein Match — Anfrage beendet.
                </p>
              )}
            </article>
          );
        })}

      {/* ---------------------------------------------
          MATCH MODAL
      --------------------------------------------- */}
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

            <label>Dauer</label>
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

      {/* ---------------------------------------------
          SESSION MODAL
      --------------------------------------------- */}
      {sessionModal && (
        <div style={modalStyle}>
          <div style={modalInner}>
            <h3>Nächste Sitzung eintragen</h3>

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

            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button onClick={saveSession}>Speichern</button>
              <button onClick={() => setSessionModal(null)}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --------------------------------
// SIMPLE MODAL STYLES
// --------------------------------
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
