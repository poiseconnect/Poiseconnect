"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// ---------------------------------------------------------
// Status-Normalisierung (robust gegen 'offen'::text usw.)
// ---------------------------------------------------------
function normalizeStatus(raw) {
  if (!raw) return "offen";

  let s = String(raw).toLowerCase().trim();
  // Supabase kann "'offen'::text" speichern
  s = s.replace(/['"]+/g, "").replace("::text", "").trim();

  if (["neu", "new", "offen", ""].includes(s)) return "offen";
  if (["termin_neu", "new_appointment"].includes(s)) return "termin_neu";
  if (["termin_bestaetigt", "confirmed"].includes(s)) return "termin_bestaetigt";
  if (["weitergeleitet", "forwarded"].includes(s)) return "weitergeleitet";
  if (["active", "aktiv"].includes(s)) return "active";
  if (["beendet", "finished", "closed"].includes(s)) return "beendet";
  if (["kein_match", "nomatch", "no_match"].includes(s)) return "kein_match";

  return "offen";
}

const STATUS_META = {
  offen: {
    label: "Neu",
    bg: "#FFF7EC",
    border: "#E3C29A",
    text: "#8B5A2B",
  },
  termin_neu: {
    label: "Neuer Termin",
    bg: "#EFF3FF",
    border: "#9AAAF5",
    text: "#304085",
  },
  termin_bestaetigt: {
    label: "Termin bestätigt",
    bg: "#EAF8EF",
    border: "#9AD0A0",
    text: "#2F6E3A",
  },
  weitergeleitet: {
    label: "Weitergeleitet",
    bg: "#F4EFFF",
    border: "#C9B0FF",
    text: "#5E3EA8",
  },
  active: {
    label: "Begleitung aktiv",
    bg: "#E8FFF0",
    border: "#90D5A0",
    text: "#2D7A45",
  },
  kein_match: {
    label: "Kein Match",
    bg: "#FFECEC",
    border: "#F2A5A5",
    text: "#9B1C2C",
  },
  beendet: {
    label: "Beendet",
    bg: "#F0F0F0",
    border: "#CCCCCC",
    text: "#666666",
  },
};

// ---------------------------------------------------------
// Einfacher Modal-Wrapper
// ---------------------------------------------------------
function Modal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
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
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 12,
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// Dashboard-Komponente
// ---------------------------------------------------------
export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [sessionsByRequest, setSessionsByRequest] = useState({});
  const [filter, setFilter] = useState("unbearbeitet"); // "unbearbeitet" | "aktiv" | "alle"
  const [loading, setLoading] = useState(true);

  // Modals
  const [matchModal, setMatchModal] = useState(null);
  const [matchTarif, setMatchTarif] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchDuration, setMatchDuration] = useState(60);

  const [sessionModal, setSessionModal] = useState(null);
  const [sessionDate, setSessionDate] = useState("");
  const [sessionDuration, setSessionDuration] = useState(60);

  const [detailsModal, setDetailsModal] = useState(null);

  // -----------------------------------------------------
  // User laden
  // -----------------------------------------------------
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    }
    loadUser();
  }, []);

  // -----------------------------------------------------
  // Anfragen laden
  // -----------------------------------------------------
  useEffect(() => {
    if (!user?.email) return;

    async function loadRequests() {
      setLoading(true);

      const email = user.email.toLowerCase();
      const isAdmin = email === "hallo@mypoise.de";

      let query = supabase.from("anfragen").select("*").order("id", {
        ascending: false,
      });

      if (!isAdmin) {
        query = query.eq("wunschtherapeut", user.email);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Fehler beim Laden der Anfragen:", error);
        setRequests([]);
      } else {
        setRequests(
          (data || []).map((r) => ({
            ...r,
            _status: normalizeStatus(r.status),
          }))
        );
      }

      setLoading(false);
    }

    loadRequests();
  }, [user]);

  // -----------------------------------------------------
  // Sessions laden und nach Anfrage gruppieren
  // -----------------------------------------------------
  useEffect(() => {
    async function loadSessions() {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("date", { ascending: true });

      if (error) {
        console.error("Fehler beim Laden der Sessions:", error);
        return;
      }

      const grouped = {};
      (data || []).forEach((s) => {
        const key = String(s.anfrage_id);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(s);
      });

      setSessionsByRequest(grouped);
    }

    loadSessions();
  }, []);

  // -----------------------------------------------------
  // Filter
  // -----------------------------------------------------
  const UNBEARBEITET_STATUS = [
    "offen",
    "termin_neu",
    "termin_bestaetigt",
    "weitergeleitet",
  ];

  const countUnbearbeitet = requests.filter((r) =>
    UNBEARBEITET_STATUS.includes(r._status)
  ).length;

  const countAktiv = requests.filter((r) => r._status === "active").length;

  const filteredRequests = requests.filter((r) => {
    if (filter === "unbearbeitet") return UNBEARBEITET_STATUS.includes(r._status);
    if (filter === "aktiv") return r._status === "active";
    return true;
  });

  // -----------------------------------------------------
  // Erstgespräch-Actions
  // -----------------------------------------------------
  async function confirmAppointment(r) {
    const res = await fetch("/api/confirm-appointment", {
      method: "POST",
      body: JSON.stringify({
        requestId: r.id,
        therapist: user.email,
        client: r.email,
        slot: r.bevorzugte_zeit || r.bevorzugt || "",
      }),
    });

    if (!res.ok) return alert("Fehler beim Bestätigen");
    alert("Termin bestätigt");
    location.reload();
  }

  async function declineAppointment(r) {
    const res = await fetch("/api/reject-appointment", {
      method: "POST",
      body: JSON.stringify({
        requestId: r.id,
        therapist: user.email,
        client: r.email,
        vorname: r.vorname,
      }),
    });

    if (!res.ok) return alert("Fehler beim Absagen");
    alert("Absage gesendet");
    location.reload();
  }

  async function newAppointment(r) {
    const res = await fetch("/api/new-appointment", {
      method: "POST",
      body: JSON.stringify({
        requestId: r.id,
        client: r.email,
        therapistEmail: user.email,
        therapistName: r.wunschtherapeut,
        vorname: r.vorname,
      }),
    });

    if (!res.ok) return alert("Fehler beim Senden");
    alert("Link zur neuen Terminauswahl gesendet");
    location.reload();
  }

  async function forwardRequest(r) {
    const res = await fetch("/api/forward-request", {
      method: "POST",
      body: JSON.stringify({
        requestId: r.id,
        client: r.email,
        vorname: r.vorname,
      }),
    });

    if (!res.ok) return alert("Fehler beim Weiterleiten");
    alert("Anfrage weitergeleitet");
    location.reload();
  }

  async function noMatch(r) {
    const res = await fetch("/api/no-match", {
      method: "POST",
      body: JSON.stringify({ anfrageId: r.id }),
    });

    if (!res.ok) return alert("Fehler bei Kein Match");
    alert("Kein Match gespeichert");
    location.reload();
  }

  // -----------------------------------------------------
  // Match / Begleitung starten
  // -----------------------------------------------------
  async function saveMatch() {
    if (!matchModal) return;
    if (!matchTarif || !matchDate) {
      alert("Bitte Honorar und erstes Sitzungsdatum eintragen.");
      return;
    }

    const res = await fetch("/api/match-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anfrageId: matchModal.id,
        honorar: Number(matchTarif),
        therapistEmail: user.email,
        nextDate: matchDate,
        duration: matchDuration,
      }),
    });

    if (!res.ok) {
      console.error(await res.text());
      alert("Fehler beim Start der Begleitung");
      return;
    }

    alert("Begleitung gestartet");
    location.reload();
  }

  // -----------------------------------------------------
  // Nächste Sitzung
  // -----------------------------------------------------
  async function saveSession() {
    if (!sessionModal) return;
    if (!sessionDate) {
      alert("Bitte Datum für die Sitzung eintragen.");
      return;
    }

    const res = await fetch("/api/add-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anfrageId: sessionModal.id,
        therapist: user.email,
        date: sessionDate,
        duration: sessionDuration,
      }),
    });

    if (!res.ok) {
      console.error(await res.text());
      alert("Fehler beim Speichern der Sitzung");
      return;
    }

    alert("Sitzung gespeichert");
    location.reload();
  }

  // -----------------------------------------------------
  // Coaching beenden
  // -----------------------------------------------------
  async function finishCoaching(r) {
    const res = await fetch("/api/finish-coaching", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anfrageId: r.id }),
    });

    if (!res.ok) return alert("Fehler beim Beenden");
    alert("Coaching beendet");
    location.reload();
  }

  // -----------------------------------------------------
  // UI
  // -----------------------------------------------------
  if (!user)
    return <div style={{ padding: 30 }}>Bitte per Magic Link einloggen…</div>;

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 960,
        margin: "0 auto",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Header */}
      <h1
        style={{
          margin: 0,
          marginBottom: 12,
          fontSize: 32,
          fontWeight: 700,
        }}
      >
        Poise Dashboard
      </h1>
      <p style={{ marginTop: 0, marginBottom: 16, color: "#666" }}>
        Eingeloggt als <strong>{user.email}</strong>
      </p>

      {/* Filter Pills */}
      <div
        style={{
          display: "flex",
          background: "#EFE5DD",
          padding: 4,
          borderRadius: 999,
          gap: 4,
          marginBottom: 20,
        }}
      >
        <button
          onClick={() => setFilter("unbearbeitet")}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 999,
            border: "none",
            background: filter === "unbearbeitet" ? "#fff" : "transparent",
            fontWeight: filter === "unbearbeitet" ? 600 : 400,
          }}
        >
          Unbearbeitet ({countUnbearbeitet})
        </button>
        <button
          onClick={() => setFilter("aktiv")}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 999,
            border: "none",
            background: filter === "aktiv" ? "#fff" : "transparent",
            fontWeight: filter === "aktiv" ? 600 : 400,
          }}
        >
          Aktiv ({countAktiv})
        </button>
        <button
          onClick={() => setFilter("alle")}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 999,
            border: "none",
            background: filter === "alle" ? "#fff" : "transparent",
            fontWeight: filter === "alle" ? 600 : 400,
          }}
        >
          Alle ({requests.length})
        </button>
      </div>

      {loading && <p>Wird geladen…</p>}

      {!loading && filteredRequests.length === 0 && (
        <p style={{ color: "#777" }}>Keine Anfragen im aktuellen Filter.</p>
      )}

      {/* Karten */}
      {!loading &&
        filteredRequests.map((r) => {
          const statusMeta = STATUS_META[r._status] || STATUS_META.offen;
          const sessionList = sessionsByRequest[String(r.id)] || [];

          return (
            <article
              key={r.id}
              style={{
                padding: 16,
                borderRadius: 16,
                border: "1px solid #e2e2e2",
                marginBottom: 16,
                background: "#fff",
                boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
              }}
            >
              {/* Kopfzeile */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
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
                        {" · Wunsch: "}
                        <strong>{r.wunschtherapeut}</strong>
                      </>
                    )}
                  </p>
                </div>

                <div
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: statusMeta.bg,
                    border: `1px solid ${statusMeta.border}`,
                    color: statusMeta.text,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {statusMeta.label}
                </div>
              </div>

              {/* Anliegen */}
              <p
                style={{
                  margin: "8px 0 4px",
                  fontSize: 14,
                }}
              >
                <strong>Anliegen:</strong> {r.anliegen || "–"}
              </p>

              <button
                type="button"
                onClick={() => setDetailsModal(r)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "#f5f5f5",
                  fontSize: 13,
                  cursor: "pointer",
                  marginBottom: 4,
                }}
              >
                Details anzeigen
              </button>

              {/* ACTIVE: Stundensatz + Sitzungen */}
              {r._status === "active" && (
                <>
                  <p style={{ marginTop: 8, fontSize: 14 }}>
                    <strong>Stundensatz:</strong>{" "}
                    {r.honorar_klient
                      ? `${r.honorar_klient} €`
                      : "– (kein Honorar gespeichert)"}
                  </p>

                  {sessionList.length > 0 && (
                    <div
                      style={{
                        marginTop: 6,
                        borderRadius: 10,
                        border: "1px solid #e0e0ff",
                        background: "#f7f7ff",
                        padding: 8,
                      }}
                    >
                      <h4
                        style={{
                          margin: "0 0 6px",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#444",
                        }}
                      >
                        Sitzungen
                      </h4>
                      {sessionList.map((s) => (
                        <div
                          key={s.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                            padding: "4px 6px",
                            borderRadius: 6,
                            background: "#fff",
                            border: "1px solid #eee",
                            marginBottom: 4,
                          }}
                        >
                          <span>
                            {s.date
                              ? new Date(s.date).toLocaleString("de-AT")
                              : "ohne Datum"}
                          </span>
                          <span>{s.duration_min} Min</span>
                          <span>
                            {Number(s.price || 0).toFixed(2)} € /{" "}
                            {Number(s.payout || 0).toFixed(2)} € netto
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Buttons – Erstgespräch (Option A + Match/No Match) */}
              {UNBEARBEITET_STATUS.includes(r._status) && (
                <>
                  {/* Erstgespräch-Buttons */}
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => confirmAppointment(r)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: "1px solid #8BC48B",
                        background: "#D4F8D4",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      ✔ Termin bestätigen
                    </button>

                    <button
                      type="button"
                      onClick={() => declineAppointment(r)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: "1px solid #E99999",
                        background: "#FFDADA",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      ✖ Absagen
                    </button>

                    <button
                      type="button"
                      onClick={() => newAppointment(r)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: "1px solid #9AAAF5",
                        background: "#E6E8FF",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      🔁 Neuer Termin
                    </button>

                    <button
                      type="button"
                      onClick={() => forwardRequest(r)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: "1px solid #E0B96F",
                        background: "#FFF1D6",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      👥 Weiterleiten
                    </button>
                  </div>

                  {/* Match / Kein Match */}
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMatchModal(r);
                        setMatchTarif(r.honorar_klient || "");
                        setMatchDate("");
                        setMatchDuration(60);
                      }}
                      style={{
                        flex: 1,
                        minWidth: 140,
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: "1px solid #88C688",
                        background: "#D5F8D5",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      ❤️ Match
                    </button>

                    <button
                      type="button"
                      onClick={() => noMatch(r)}
                      style={{
                        flex: 1,
                        minWidth: 140,
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: "1px solid #E99999",
                        background: "#FFE1E1",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      ❌ Kein Match
                    </button>
                  </div>
                </>
              )}

              {/* Buttons – aktive Begleitung */}
              {r._status === "active" && (
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSessionModal(r);
                      setSessionDate("");
                      setSessionDuration(60);
                    }}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: 999,
                      border: "1px solid #9AAAF5",
                      background: "rgba(150,170,255,0.25)",
                      fontSize: 13,
                      cursor: "pointer",
                      color: "#304085",
                      fontWeight: 600,
                    }}
                  >
                    ➕ nächste Sitzung
                  </button>

                  <button
                    type="button"
                    onClick={() => finishCoaching(r)}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: 999,
                      border: "1px solid #E99999",
                      background: "#FFDADA",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    🔴 Coaching beenden
                  </button>
                </div>
              )}

              {r._status === "kein_match" && (
                <p style={{ marginTop: 10, fontSize: 13, color: "#A33" }}>
                  Kein Match – Anfrage wurde geschlossen.
                </p>
              )}

              {r._status === "beendet" && (
                <p style={{ marginTop: 10, fontSize: 13, color: "#555" }}>
                  Coaching wurde beendet.
                </p>
              )}
            </article>
          );
        })}

      {/* Match-Modal */}
      {matchModal && (
        <Modal onClose={() => setMatchModal(null)}>
          <h3 style={{ marginTop: 0 }}>Begleitung starten</h3>
          <p style={{ fontSize: 14, marginTop: 4 }}>
            Klient:{" "}
            <strong>
              {matchModal.vorname} {matchModal.nachname}
            </strong>
          </p>

          <label style={{ fontSize: 13, marginTop: 10 }}>Stundensatz (€)</label>
          <input
            type="number"
            value={matchTarif}
            onChange={(e) => setMatchTarif(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #ddd",
              marginBottom: 8,
            }}
          />

          <label style={{ fontSize: 13 }}>Erste Sitzung</label>
          <input
            type="datetime-local"
            value={matchDate}
            onChange={(e) => setMatchDate(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #ddd",
              marginBottom: 8,
            }}
          />

          <label style={{ fontSize: 13 }}>Dauer</label>
          <select
            value={matchDuration}
            onChange={(e) => setMatchDuration(Number(e.target.value))}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #ddd",
              marginBottom: 12,
            }}
          >
            <option value={50}>50 Minuten</option>
            <option value={60}>60 Minuten</option>
            <option value={75}>75 Minuten</option>
          </select>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setMatchModal(null)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid #ccc",
                background: "#f5f5f5",
                fontSize: 13,
              }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={saveMatch}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid #88C688",
                background: "#D5F8D5",
                fontSize: 13,
              }}
            >
              Speichern
            </button>
          </div>
        </Modal>
      )}

      {/* Session-Modal */}
      {sessionModal && (
        <Modal onClose={() => setSessionModal(null)}>
          <h3 style={{ marginTop: 0 }}>Nächste Sitzung</h3>
          <p style={{ fontSize: 14, marginTop: 4 }}>
            Klient:{" "}
            <strong>
              {sessionModal.vorname} {sessionModal.nachname}
            </strong>
          </p>

          <label style={{ fontSize: 13, marginTop: 10 }}>Datum & Uhrzeit</label>
          <input
            type="datetime-local"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #ddd",
              marginBottom: 8,
            }}
          />

          <label style={{ fontSize: 13 }}>Dauer</label>
          <select
            value={sessionDuration}
            onChange={(e) => setSessionDuration(Number(e.target.value))}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #ddd",
              marginBottom: 12,
            }}
          >
            <option value={50}>50 Minuten</option>
            <option value={60}>60 Minuten</option>
            <option value={75}>75 Minuten</option>
          </select>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setSessionModal(null)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid #ccc",
                background: "#f5f5f5",
                fontSize: 13,
              }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={saveSession}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid #9AAAF5",
                background: "rgba(150,170,255,0.25)",
                fontSize: 13,
                color: "#304085",
                fontWeight: 600,
              }}
            >
              Speichern
            </button>
          </div>
        </Modal>
      )}

      {/* Details-Modal */}
      {detailsModal && (
        <Modal onClose={() => setDetailsModal(null)}>
          <h3 style={{ marginTop: 0 }}>Anfrage-Details</h3>

          <p>
            <strong>Name:</strong> {detailsModal.vorname}{" "}
            {detailsModal.nachname}
          </p>
          <p>
            <strong>E-Mail:</strong> {detailsModal.email}
          </p>
          <p>
            <strong>Telefon:</strong> {detailsModal.telefon}
          </p>
          <p>
            <strong>Adresse:</strong> {detailsModal.adresse}
          </p>

          <hr />

          <p>
            <strong>Anliegen:</strong>
            <br />
            {detailsModal.anliegen}
          </p>
          <p>
            <strong>Leidensdruck:</strong> {detailsModal.leidensdruck}
          </p>
          <p>
            <strong>Verlauf:</strong>
            <br />
            {detailsModal.verlauf}
          </p>
          <p>
            <strong>Diagnose:</strong> {detailsModal.diagnose}
          </p>
          <p>
            <strong>Ziel:</strong>
            <br />
            {detailsModal.ziel}
          </p>

          <div style={{ textAlign: "right", marginTop: 12 }}>
            <button
              type="button"
              onClick={() => setDetailsModal(null)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid #ccc",
                background: "#f5f5f5",
                fontSize: 13,
              }}
            >
              Schließen
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
