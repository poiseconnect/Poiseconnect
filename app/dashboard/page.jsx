"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// -------------------------------
// STATUS-DEFINITIONEN
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
  const [filter, setFilter] = useState<"neu" | "bearbeitet" | "alle">("neu");

  // MATCH-Modal
  const [matchModal, setMatchModal] = useState(null);
  const [tarif, setTarif] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionDuration, setSessionDuration] = useState(60);

  // SESSION-Modal
  const [sessionModal, setSessionModal] = useState(null);

  // -------------------------------
  // USER LADEN
  // -------------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  // -------------------------------
  // ANFRAGEN + SESSIONS LADEN
  // -------------------------------
  useEffect(() => {
    if (!user?.email) return;

    async function load() {
      setLoading(true);

      const email = user.email.toLowerCase();
      const isAdmin = email === "hallo@mypoise.de";

      let query = supabase
        .from("anfragen")
        .select("*")
        .order("id", { ascending: false });

      // wie vorher: Nicht-Admin sieht nur eigene Anfragen
      if (!isAdmin) {
        query = query.eq("wunschtherapeut", user.email);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase anfragen Fehler:", error);
        setRequests([]);
        setLoading(false);
        return;
      }

      // Sessions je Anfrage laden
      const withSessions = await Promise.all(
        (data || []).map(async (req) => {
          const { data: sessions, error: sesErr } = await supabase
            .from("sessions")
            .select("*")
            .eq("anfrage_id", req.id)
            .order("date", { ascending: true });

          if (sesErr) {
            console.error("Supabase sessions Fehler:", sesErr);
          }

          return { ...req, sessions: sessions || [] };
        })
      );

      setRequests(withSessions);
      setLoading(false);
    }

    load();
  }, [user]);

  // -------------------------------
  // API: Termin bestätigen
  // -------------------------------
  async function confirmAppointment(req) {
    const res = await fetch("/api/confirm-appointment", {
      method: "POST",
      body: JSON.stringify({
        requestId: req.id,
        therapist: user.email,
        client: req.email,
        slot: req.bevorzugte_zeit,
      }),
    });

    if (res.ok) {
      alert("Termin bestätigt.");
      window.location.reload();
    } else alert("Fehler beim Bestätigen.");
  }

  // -------------------------------
  // API: Absagen
  // -------------------------------
  async function decline(req) {
    const res = await fetch("/api/reject-appointment", {
      method: "POST",
      body: JSON.stringify({
        requestId: req.id,
        therapist: user.email,
        client: req.email,
        vorname: req.vorname,
      }),
    });

    if (res.ok) {
      alert("Absage gesendet.");
      window.location.reload();
    } else alert("Fehler beim Absagen.");
  }

  // -------------------------------
  // API: Neuer Termin-Link
  // -------------------------------
  async function newAppointment(req) {
    const res = await fetch("/api/new-appointment", {
      method: "POST",
      body: JSON.stringify({
        requestId: req.id,
        client: req.email,
        therapistEmail: user.email,
        therapistName: req.wunschtherapeut,
        vorname: req.vorname,
      }),
    });

    if (res.ok) {
      alert("Neuer Termin-Link wurde gesendet.");
      window.location.reload();
    } else alert("Fehler beim Senden.");
  }

  // -------------------------------
  // API: Weiterleiten
  // -------------------------------
  async function reassign(req) {
    const res = await fetch("/api/forward-request", {
      method: "POST",
      body: JSON.stringify({
        requestId: req.id,
        client: req.email,
        vorname: req.vorname,
      }),
    });

    if (res.ok) {
      alert("Anfrage weitergeleitet.");
      window.location.reload();
    } else alert("Fehler beim Weiterleiten.");
  }

  // -------------------------------
  // API: NO MATCH
  // -------------------------------
  async function noMatch(req) {
    const res = await fetch("/api/no-match", {
      method: "POST",
      body: JSON.stringify({ anfrageId: req.id }),
    });

    if (res.ok) {
      alert("Kein Match gespeichert.");
      window.location.reload();
    } else alert("Fehler.");
  }

  // -------------------------------
  // API: MATCH → COACHING START
  // -------------------------------
  async function saveMatch() {
    if (!tarif || !sessionDate) {
      alert("Bitte Tarif & ersten Termin eintragen.");
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

    if (res.ok) {
      alert("Match gespeichert – Begleitung gestartet.");
      window.location.reload();
    } else alert("Fehler beim Match.");
  }

  // -------------------------------
  // API: Neue Sitzung
  // -------------------------------
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

    if (res.ok) {
      alert("Sitzung gespeichert.");
      window.location.reload();
    } else alert("Fehler beim Speichern.");
  }

  // -------------------------------
  // API: Coaching beenden
  // -------------------------------
  async function finishCoaching(req) {
    const res = await fetch("/api/finish-coaching", {
      method: "POST",
      body: JSON.stringify({ anfrageId: req.id }),
    });

    if (res.ok) {
      alert("Coaching beendet.");
      window.location.reload();
    } else alert("Fehler beim Beenden.");
  }

  // -------------------------------
  // FILTER AUF STATUS
  // -------------------------------
  const filteredRequests = requests.filter((r) => {
    const status = r.status || "neu";

    if (filter === "neu") {
      return status === "neu" || status === "termin_neu" || status === "termin_bestaetigt";
    }
    if (filter === "bearbeitet") {
      return !["neu", "termin_neu", "termin_bestaetigt"].includes(status);
    }
    return true; // alle
  });

  const countNeu = requests.filter((r) =>
    ["neu", "termin_neu", "termin_bestaetigt"].includes(r.status || "neu")
  ).length;
  const countBearbeitet = requests.length - countNeu;

  // -------------------------------
  // UI
  // -------------------------------
  if (!user)
    return <div style={{ padding: 40 }}>Bitte per Magic Link einloggen…</div>;

  return (
    <div
      style={{
        padding: 40,
        maxWidth: 960,
        margin: "0 auto",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: 0.2,
            }}
          >
            Poise Dashboard
          </h1>
          <p style={{ margin: "6px 0 0", color: "#666", fontSize: 14 }}>
            Eingeloggt als <strong>{user.email}</strong>
          </p>
        </div>

        {/* Status-Filter */}
        <div
          style={{
            display: "flex",
            background: "#F4ECE4",
            borderRadius: 999,
            padding: 4,
            gap: 4,
            minWidth: 260,
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={() => setFilter("neu")}
            style={{
              flex: 1,
              borderRadius: 999,
              border: "none",
              padding: "6px 12px",
              fontSize: 13,
              cursor: "pointer",
              background: filter === "neu" ? "#FFFFFF" : "transparent",
              fontWeight: filter === "neu" ? 600 : 400,
              color: filter === "neu" ? "#5A3B24" : "#7D5D43",
            }}
          >
            Neu ({countNeu})
          </button>
          <button
            onClick={() => setFilter("bearbeitet")}
            style={{
              flex: 1,
              borderRadius: 999,
              border: "none",
              padding: "6px 12px",
              fontSize: 13,
              cursor: "pointer",
              background: filter === "bearbeitet" ? "#FFFFFF" : "transparent",
              fontWeight: filter === "bearbeitet" ? 600 : 400,
              color: filter === "bearbeitet" ? "#5A3B24" : "#7D5D43",
            }}
          >
            Bearbeitet ({countBearbeitet})
          </button>
          <button
            onClick={() => setFilter("alle")}
            style={{
              flex: 1,
              borderRadius: 999,
              border: "none",
              padding: "6px 12px",
              fontSize: 13,
              cursor: "pointer",
              background: filter === "alle" ? "#FFFFFF" : "transparent",
              fontWeight: filter === "alle" ? 600 : 400,
              color: filter === "alle" ? "#5A3B24" : "#7D5D43",
            }}
          >
            Alle ({requests.length})
          </button>
        </div>
      </header>

      <hr
        style={{
          border: "none",
          borderTop: "1px solid #eee",
          marginBottom: 20,
        }}
      />

      {loading && <p>Wird geladen…</p>}

      {!loading && filteredRequests.length === 0 && (
        <p style={{ color: "#777" }}>Keine Anfragen.</p>
      )}

      {!loading &&
        filteredRequests.map((r) => {
          const statusKey = r.status || "neu";
          const colors = STATUS_COLORS[statusKey] || STATUS_COLORS["neu"];

          return (
            <article
              key={r.id}
              style={{
                padding: 18,
                borderRadius: 12,
                border: "1px solid #e5e5e5",
                marginBottom: 14,
                background: "#fff",
                boxShadow:
                  statusKey === "neu"
                    ? "0 6px 16px rgba(0,0,0,0.03)"
                    : "0 2px 6px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  marginBottom: 8,
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 600,
                    }}
                  >
                    {r.vorname} {r.nachname}
                  </h3>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 13,
                      color: "#777",
                    }}
                  >
                    {r.email}
                    {r.wunschtherapeut && (
                      <>
                        {" · "}Wunsch:{" "}
                        <strong>{r.wunschtherapeut}</strong>
                      </>
                    )}
                  </p>
                </div>

                {/* Status Badge */}
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    fontSize: 12,
                    color: colors.text,
                    fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      backgroundColor: colors.text,
                    }}
                  />
                  <span>{STATUS_LABELS[statusKey] || "Neu"}</span>
                </div>
              </div>

              {r.anliegen && (
                <p
                  style={{
                    margin: "8px 0 4px",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Anliegen:</strong> {r.anliegen}
                </p>
              )}

              {/* ---------------------------------------------
                  PHASE: ERSTGESPRÄCH
              --------------------------------------------- */}
              {["neu", "termin_neu", "termin_bestaetigt", "weitergeleitet"].includes(
                statusKey
              ) && (
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
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

                  <button onClick={() => setMatchModal(r)}>💚 Match</button>

                  <button onClick={() => noMatch(r)}>❌ No Match</button>
                </div>
              )}

              {/* ---------------------------------------------
                  PHASE: COACHING
              --------------------------------------------- */}
              {statusKey === "active" && (
                <div style={{ marginTop: 10 }}>
                  <p>
                    <strong>Tarif:</strong>{" "}
                    {r.honorar_klient
                      ? `${r.honorar_klient} € / Stunde`
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

              {/* ---------------------------------------------
                  PHASE: ABGESCHLOSSEN
              --------------------------------------------- */}
              {statusKey === "finished" && (
                <p style={{ marginTop: 10, fontStyle: "italic" }}>
                  Coaching abgeschlossen.
                </p>
              )}

              {statusKey === "no_match" && (
                <p style={{ marginTop: 10, color: "#a33" }}>
                  Kein Match — Anfrage beendet.
                </p>
              )}

              {/* ---------------------------------------------
                  SITZUNGSLISTE
              --------------------------------------------- */}
              {r.sessions?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <h4 style={{ marginBottom: 8 }}>Bisherige Sitzungen</h4>

                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #eee",
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    {r.sessions.map((s, i) => (
                      <div
                        key={s.id}
                        style={{
                          padding: "6px 0",
                          borderBottom:
                            i === r.sessions.length - 1
                              ? "none"
                              : "1px solid #eee",
                        }}
                      >
                        <div style={{ fontSize: 14 }}>
                          <strong>
                            {new Date(s.date).toLocaleString("de-AT")}
                          </strong>{" "}
                          · {s.duration_min} Min
                        </div>

                        <div style={{ fontSize: 13, color: "#444" }}>
                          Honorar: {s.price.toFixed(2)} € • Provision:{" "}
                          {s.commission.toFixed(2)} € • Auszahlung:{" "}
                          {s.payout.toFixed(2)} €
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}

      {/* -------------------------
          MATCH MODAL
      ------------------------- */}
      {matchModal && (
        <Modal>
          <h3>Begleitung starten</h3>

          <label>Stundensatz (€)</label>
          <input
            value={tarif}
            onChange={(e) => setTarif(e.target.value)}
          />

          <label>Erste Sitzung</label>
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
        </Modal>
      )}

      {/* -------------------------
          SESSION MODAL
      ------------------------- */}
      {sessionModal && (
        <Modal>
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

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button onClick={saveSession}>Speichern</button>
            <button onClick={() => setSessionModal(null)}>Abbrechen</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// -------------------------------
// MODAL COMPONENT
// -------------------------------
function Modal({ children }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 99,
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 12,
          minWidth: 300,
        }}
      >
        {children}
      </div>
    </div>
  );
}
