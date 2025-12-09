"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// ---------------------------------------------------------
// STATUS-DEFINITIONEN
// ---------------------------------------------------------
const STATUS_LABELS = {
  offen: "Neu",
  termin_neu: "Neuen Termin wählen",
  termin_bestaetigt: "Termin bestätigt",
  weitergeleitet: "Weitergeleitet",
  active: "Begleitung aktiv",
  beendet: "Beendet",
  kein_match: "Kein Match",
};

const STATUS_COLORS = {
  offen: { bg: "#FFF7EC", border: "#E3C29A", text: "#8B5A2B" },
  termin_neu: { bg: "#EFF3FF", border: "#9AAAF5", text: "#304085" },
  termin_bestaetigt: { bg: "#EAF8EF", border: "#9AD0A0", text: "#2F6E3A" },
  weitergeleitet: { bg: "#F9F5FF", border: "#C8B0F5", text: "#54358B" },
  active: { bg: "#E7FFE7", border: "#52C352", text: "#1A6B1A" },
  beendet: { bg: "#EEE", border: "#CCC", text: "#666" },
  kein_match: { bg: "#FEECEC", border: "#F1A5A5", text: "#8B1E2B" },
};

// ---------------------------------------------------------
// ROBUSTE STATUS-NORMALISIERUNG
// ---------------------------------------------------------
function normalizeStatus(raw) {
  if (!raw || raw === "" || raw === null) return "offen";
  const s = String(raw).toLowerCase().trim();

  if (["neu", "new", "offen"].includes(s)) return "offen";
  if (["termin_neu", "new_appointment"].includes(s)) return "termin_neu";
  if (["termin_bestaetigt", "confirmed"].includes(s)) return "termin_bestaetigt";
  if (["weitergeleitet", "forwarded"].includes(s)) return "weitergeleitet";
  if (["active", "aktiv"].includes(s)) return "active";
  if (["beendet", "finished", "closed"].includes(s)) return "beendet";
  if (["kein_match", "nomatch", "no_match"].includes(s)) return "kein_match";

  return "offen";
}

// ---------------------------------------------------------
// MODAL-KOMPONENTE
// ---------------------------------------------------------
function Modal({ children, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 12,
          width: "100%",
          maxWidth: 500,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 6px 20px rgba(0,0,0,0.22)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// DASHBOARD-KOMPONENTE
// ---------------------------------------------------------
export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [filter, setFilter] = useState("unbearbeitet");
  const [loading, setLoading] = useState(true);

  // Match Modal
  const [matchModal, setMatchModal] = useState(null);
  const [tarif, setTarif] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionDuration, setSessionDuration] = useState(60);

  // Session modal
  const [sessionModal, setSessionModal] = useState(null);

  // Anfrage-Details Modal
  const [detailsModal, setDetailsModal] = useState(null);

  // -----------------------------------------------------
  // USER LADEN
  // -----------------------------------------------------
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    }
    loadUser();
  }, []);

  // -----------------------------------------------------
  // ANFRAGEN + SESSIONS LADEN
  // -----------------------------------------------------
  useEffect(() => {
    if (!user?.email) return;

    async function load() {
      setLoading(true);

      const email = user.email.toLowerCase();
      const isAdmin = email === "hallo@mypoise.de";

      let query = supabase.from("anfragen").select("*").order("id", {
        ascending: false,
      });

      if (!isAdmin) query = query.eq("wunschtherapeut", user.email);

      const { data: reqs } = await query;
      setRequests(reqs || []);

      const { data: sess } = await supabase
        .from("sessions")
        .select("*")
        .order("date", { ascending: true });

      setSessions(sess || []);
      setLoading(false);
    }

    load();
  }, [user]);

  // -----------------------------------------------------
  // REQUESTS + STATUS NORMALISIEREN
  // -----------------------------------------------------
  const normalized = requests.map((r) => ({
    ...r,
    _status: normalizeStatus(r.status),
    _sessions: sessions.filter((s) => Number(s.anfrage_id) === Number(r.id)),
  }));

  // -----------------------------------------------------
  // FILTER
  // -----------------------------------------------------
  const filtered = normalized.filter((r) => {
    if (filter === "unbearbeitet")
      return ["offen", "termin_neu", "termin_bestaetigt", "weitergeleitet"].includes(
        r._status
      );
    if (filter === "active") return r._status === "active";
    return true;
  });

  const countUnbearbeitet = normalized.filter((r) =>
    ["offen", "termin_neu", "termin_bestaetigt", "weitergeleitet"].includes(
      r._status
    )
  ).length;

  const countActive = normalized.filter((r) => r._status === "active").length;

  // -----------------------------------------------------
  // API Calls (Confirm, Decline, Forward, New Appointment)
  // -----------------------------------------------------
  async function confirmAppointment(r) {
    await fetch("/api/confirm-appointment", {
      method: "POST",
      body: JSON.stringify({
        requestId: r.id,
        therapist: user.email,
        client: r.email,
        slot: r.bevorzugte_zeit || "",
      }),
    });
    alert("Termin bestätigt");
    window.location.reload();
  }

  async function decline(r) {
    await fetch("/api/reject-appointment", {
      method: "POST",
      body: JSON.stringify({
        requestId: r.id,
        therapist: user.email,
        client: r.email,
      }),
    });
    alert("Absage gesendet");
    window.location.reload();
  }

  async function newAppointment(r) {
    await fetch("/api/new-appointment", {
      method: "POST",
      body: JSON.stringify({
        requestId: r.id,
        client: r.email,
        therapistEmail: user.email,
        therapistName: r.wunschtherapeut,
      }),
    });
    alert("Neuer Terminlink gesendet");
    window.location.reload();
  }

  async function forward(r) {
    await fetch("/api/forward-request", {
      method: "POST",
      body: JSON.stringify({
        requestId: r.id,
        client: r.email,
        vorname: r.vorname,
      }),
    });
    alert("Weitergeleitet");
    window.location.reload();
  }

  async function noMatch(r) {
    await fetch("/api/no-match", {
      method: "POST",
      body: JSON.stringify({ anfrageId: r.id }),
    });
    alert("Kein Match gespeichert");
    window.location.reload();
  }

  // -----------------------------------------------------
  // MATCH (START BEGLEITUNG)
  // -----------------------------------------------------
  async function saveMatch() {
    const body = {
      id: matchModal.id,
      honorar_klient: Number(tarif),
      therapist: user.email,
      date: sessionDate,
      duration_min: sessionDuration,
    };

    await fetch("/api/match-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    alert("Begleitung gestartet");
    window.location.reload();
  }

  // -----------------------------------------------------
  // NÄCHSTE SITZUNG
  // -----------------------------------------------------
  async function saveSession() {
    const body = {
      id: sessionModal.id,
      therapist: user.email,
      date: sessionDate,
      duration_min: sessionDuration,
    };

    await fetch("/api/add-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    alert("Sitzung gespeichert");
    window.location.reload();
  }

  // -----------------------------------------------------
  // COACHING BEENDET
  // -----------------------------------------------------
  async function finishCoaching(r) {
    await fetch("/api/finish-coaching", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anfrageId: r.id }),
    });

    alert("Coaching beendet");
    window.location.reload();
  }

  // -----------------------------------------------------
  // UI
  // -----------------------------------------------------
  if (!user)
    return <div style={{ padding: 30 }}>Bitte per Magic Link einloggen…</div>;

  return (
    <div style={{ padding: 30, maxWidth: 1000, margin: "0 auto" }}>
      <h1>Poise Dashboard</h1>

      {/* FILTER */}
      <div
        style={{
          display: "flex",
          background: "#F4ECE4",
          padding: 4,
          borderRadius: 999,
          margin: "16px 0 20px",
        }}
      >
        <button
          onClick={() => setFilter("unbearbeitet")}
          style={{
            flex: 1,
            padding: "8px 12px",
            background: filter === "unbearbeitet" ? "#fff" : "transparent",
            borderRadius: 999,
            border: "none",
          }}
        >
          Unbearbeitet ({countUnbearbeitet})
        </button>

        <button
          onClick={() => setFilter("active")}
          style={{
            flex: 1,
            padding: "8px 12px",
            background: filter === "active" ? "#fff" : "transparent",
            borderRadius: 999,
            border: "none",
          }}
        >
          Aktiv ({countActive})
        </button>

        <button
          onClick={() => setFilter("alle")}
          style={{
            flex: 1,
            padding: "8px 12px",
            background: filter === "alle" ? "#fff" : "transparent",
            borderRadius: 999,
            border: "none",
          }}
        >
          Alle ({normalized.length})
        </button>
      </div>

      {/* LISTE */}
      {filtered.map((r) => {
        const s = r._status;
        const colors = STATUS_COLORS[s];

        return (
          <div
            key={r.id}
            style={{
              background: "#fff",
              padding: 18,
              border: "1px solid #ddd",
              borderRadius: 12,
              marginBottom: 14,
            }}
          >
            {/* HEADER */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <strong style={{ fontSize: 18 }}>
                  {r.vorname} {r.nachname}
                </strong>
                <br />
                <span style={{ color: "#666", fontSize: 13 }}>{r.email}</span>
              </div>

              <div
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  height: 24,
                  fontSize: 12,
                }}
              >
                {STATUS_LABELS[s]}
              </div>
            </div>

            {/* DETAILS BUTTON */}
            <button
              onClick={() => setDetailsModal(r)}
              style={{
                marginTop: 8,
                border: "none",
                background: "#F3F3F3",
                padding: "4px 10px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Anfrage anzeigen
            </button>

            {/* ERSTGESPRÄCH PHASE */}
            {["offen", "termin_neu", "termin_bestaetigt", "weitergeleitet"].includes(
              s
            ) && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => confirmAppointment(r)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "#D4F8D4",
                  }}
                >
                  ✔ Termin bestätigen
                </button>

                <button
                  onClick={() => decline(r)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "#FFDADA",
                  }}
                >
                  ✖ Absagen
                </button>

                <button
                  onClick={() => newAppointment(r)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "#E6E8FF",
                  }}
                >
                  🔁 Neuer Termin
                </button>

                <button
                  onClick={() => forward(r)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "#FFF1D6",
                  }}
                >
                  👥 Weiterleiten
                </button>

                <button
                  onClick={() => setMatchModal(r)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "#E4FFEC",
                  }}
                >
                  ❤️ Match
                </button>

                <button
                  onClick={() => noMatch(r)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "#FFE1E1",
                  }}
                >
                  ❌ Kein Match
                </button>
              </div>
            )}

            {/* AKTIVE BEGLEITUNG */}
            {s === "active" && (
              <>
                <p style={{ marginTop: 10 }}>
                  <strong>Stundensatz:</strong> {r.honorar_klient} €
                </p>

                {r._sessions.map((s, idx) => (
                  <div key={idx} style={{ marginBottom: 6, fontSize: 13 }}>
                    • {new Date(s.date).toLocaleString("de-AT")} {s.duration_min} Min –{" "}
                    {s.price} €
                  </div>
                ))}

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => setSessionModal(r)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      background: "#E8F0FF",
                    }}
                  >
                    ➕ nächste Sitzung
                  </button>

                  <button
                    onClick={() => finishCoaching(r)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      background: "#FFDADA",
                    }}
                  >
                    🔴 Coaching beenden
                  </button>
                </div>
              </>
            )}

            {s === "kein_match" && (
              <p style={{ marginTop: 10, color: "#A33" }}>Kein Match gespeichert.</p>
            )}

            {s === "beendet" && (
              <p style={{ marginTop: 10, color: "#555" }}>Coaching beendet.</p>
            )}
          </div>
        );
      })}

      {/* MATCH MODAL */}
      {matchModal && (
        <Modal onClose={() => setMatchModal(null)}>
          <h3>Begleitung starten</h3>

          <label>Stundensatz</label>
          <input
            type="number"
            value={tarif}
            onChange={(e) => setTarif(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />

          <label>Erste Sitzung</label>
          <input
            type="datetime-local"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />

          <button onClick={saveMatch} style={{ marginRight: 10 }}>
            Speichern
          </button>
          <button onClick={() => setMatchModal(null)}>Abbrechen</button>
        </Modal>
      )}

      {/* SESSION MODAL */}
      {sessionModal && (
        <Modal onClose={() => setSessionModal(null)}>
          <h3>Nächste Sitzung</h3>

          <label>Datum</label>
          <input
            type="datetime-local"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />

          <button onClick={saveSession} style={{ marginRight: 10 }}>
            Speichern
          </button>
          <button onClick={() => setSessionModal(null)}>Abbrechen</button>
        </Modal>
      )}

      {/* DETAILS MODAL */}
      {detailsModal && (
        <Modal onClose={() => setDetailsModal(null)}>
          <h3>Anfrage-Details</h3>

          <p><strong>Anliegen:</strong><br />{detailsModal.anliegen}</p>
          <p><strong>Leidensdruck:</strong> {detailsModal.leidensdruck}</p>
          <p><strong>Verlauf:</strong><br />{detailsModal.verlauf}</p>
          <p><strong>Diagnose:</strong> {detailsModal.diagnose}</p>
          <p><strong>Ziel:</strong><br />{detailsModal.ziel}</p>

          <hr />

          <p><strong>Name:</strong> {detailsModal.vorname} {detailsModal.nachname}</p>
          <p><strong>E-Mail:</strong> {detailsModal.email}</p>
          <p><strong>Telefon:</strong> {detailsModal.telefon}</p>
          <p><strong>Adresse:</strong> {detailsModal.adresse}</p>

          <button onClick={() => setDetailsModal(null)}>Schließen</button>
        </Modal>
      )}
    </div>
  );
}
