"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// ---------------------------------------------------------
// STATUS-NORMALISIERUNG
// ---------------------------------------------------------
function normalizeStatus(raw) {
  if (!raw) return "offen";

  let s = String(raw).toLowerCase().trim();
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
  offen: { label: "Neu", bg: "#FFF7EC", border: "#E3C29A", text: "#8B5A2B" },
  termin_neu: { label: "Neuer Termin", bg: "#EFF3FF", border: "#9AAAF5", text: "#304085" },
  termin_bestaetigt: { label: "Termin bestätigt", bg: "#EAF8EF", border: "#9AD0A0", text: "#2F6E3A" },
  weitergeleitet: { label: "Weitergeleitet", bg: "#F4EFFF", border: "#C9B0FF", text: "#5E3EA8" },
  active: { label: "Begleitung aktiv", bg: "#E8FFF0", border: "#90D5A0", text: "#2D7A45" },
  kein_match: { label: "Kein Match", bg: "#FFECEC", border: "#F2A5A5", text: "#9B1C2C" },
  beendet: { label: "Beendet", bg: "#F0F0F0", border: "#CCCCCC", text: "#666" },
};

// ---------------------------------------------------------
// MODAL
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
// DASHBOARD
// ---------------------------------------------------------
export default function DashboardFull() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [sessionsByRequest, setSessionsByRequest] = useState({});
  const [filter, setFilter] = useState("unbearbeitet");
  const [loading, setLoading] = useState(true);

  const [matchModal, setMatchModal] = useState(null);
  const [matchTarif, setMatchTarif] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchDuration, setMatchDuration] = useState(60);

  const [sessionModal, setSessionModal] = useState(null);
  const [sessionDate, setSessionDate] = useState("");
  const [sessionDuration, setSessionDuration] = useState(60);

  const [detailsModal, setDetailsModal] = useState(null);

  // USER LADEN
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    }
    loadUser();
  }, []);

  // ANFRAGEN LADEN
  useEffect(() => {
    if (!user?.email) return;

    async function load() {
      setLoading(true);
      const email = user.email.toLowerCase();
      const isAdmin = email === "hallo@mypoise.de";

      let query = supabase.from("anfragen").select("*").order("id", { ascending: false });
      if (!isAdmin) query = query.eq("wunschtherapeut", user.email);

      const { data } = await query;
      setRequests((data || []).map((r) => ({ ...r, _status: normalizeStatus(r.status) })));
      setLoading(false);
    }

    load();
  }, [user]);

  // SESSIONS LADEN
  useEffect(() => {
    async function loadSessions() {
      const { data } = await supabase.from("sessions").select("*").order("date", { ascending: true });
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

  // FILTERS
  const UNBEARBEITET = ["offen", "termin_neu", "termin_bestaetigt", "weitergeleitet"];
  const countUnbearbeitet = requests.filter((r) => UNBEARBEITET.includes(r._status)).length;
  const countAktiv = requests.filter((r) => r._status === "active").length;

  const filteredRequests = requests.filter((r) => {
    if (filter === "unbearbeitet") return UNBEARBEITET.includes(r._status);
    if (filter === "aktiv") return r._status === "active";
    return true;
  });

  // -----------------------------------------------------
  // API-FUNKTIONEN — Button Fixes
  // -----------------------------------------------------

  async function confirmAppointment(r) {

  // ✅ HIER – VOR dem fetch
  if (!r.bevorzugte_zeit) {
    alert("Bitte zuerst einen Termin auswählen.");
    return;
  }

  const res = await fetch("/api/confirm-appointment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: r.id,
      therapist: user.email,
      client: r.email,
      slot: r.bevorzugte_zeit, // ← KEIN leerer String mehr
    }),
  });
}
    if (!res.ok) return alert("Fehler beim Bestätigen");
    alert("Termin bestätigt");
    location.reload();
  }

  async function declineAppointment(r) {
    const res = await fetch("/api/reject-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: r.id,
        client: r.email,
        therapistEmail: user.email,
        therapistName: r.wunschtherapeut,
        vorname: r.vorname,
      }),
    });

    if (!res.ok) return alert("Fehler beim Senden");
    alert("Neuer Terminlink wurde versendet");
    location.reload();
  }

  async function forwardRequest(r) {
    const res = await fetch("/api/forward-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: r.id,
        client: r.email,
        vorname: r.vorname,
      }),
    });

    if (!res.ok) return alert("Fehler beim Weiterleiten");
    alert("Anfrage wurde weitergeleitet");
    location.reload();
  }

  async function noMatch(r) {
    const res = await fetch("/api/no-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anfrageId: r.id }), // unverändert
    });

    if (!res.ok) return alert("Fehler bei Kein Match");
    alert("Kein Match eingetragen");
    location.reload();
  }

  // ✅ FIX 1 — MATCH BUTTON
 async function saveMatch() {
  if (!matchModal) return;
  if (!matchTarif || !matchDate) {
    alert("Bitte Honorar und Datum eingeben.");
    return;
  }

  const res = await fetch("/api/match-client", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      anfrageId: matchModal.id,          // ✅ richtiger Name
      honorar: Number(matchTarif),
      therapistEmail: user.email,        // ✅ so erwartet es deine Route
      nextDate: matchDate,
      duration: matchDuration,
    }),
  });

  if (!res.ok) {
    alert("Fehler beim Speichern");
    return;
  }

  alert("Begleitung gestartet");
  location.reload();
}


  // ✅ FIX 2 — NÄCHSTE SITZUNG
  async function saveSession() {
  if (!sessionModal) return;
  if (!sessionDate) return alert("Datum fehlt");

  const res = await fetch("/api/add-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      anfrageId: sessionModal.id,    // ✅ richtiger Name
      therapist: user.email,         // ✅ so heißt das Feld in der Route
      date: sessionDate,
      duration: sessionDuration,
    }),
  });

  if (!res.ok) {
    alert("Fehler beim Speichern der Sitzung");
    return;
  }

  alert("Sitzung gespeichert");
  location.reload();
}


  // ✅ FIX 3 — COACHING BEENDEN
  async function finishCoaching(r) {
  const res = await fetch("/api/finish-coaching", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      anfrageId: r.id,      // ✅ zurück auf anfrageId
    }),
  });

  if (!res.ok) return alert("Fehler beim Beenden");
  alert("Coaching beendet");
  location.reload();
}


  // -----------------------------------------------------
  // UI — LOGIN
  // -----------------------------------------------------
  if (!user) return <div style={{ padding: 30 }}>Bitte per Magic Link einloggen…</div>;

  // -----------------------------------------------------
  // UI — DASHBOARD
  // -----------------------------------------------------
  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1>Poise Dashboard</h1>
      <p style={{ marginTop: -10, marginBottom: 20 }}>Eingeloggt als <strong>{user.email}</strong></p>

      {/* FILTER */}
      <div style={{
        display: "flex", background: "#EFE5DD", padding: 4,
        borderRadius: 999, gap: 4, marginBottom: 20,
      }}>
        <button onClick={() => setFilter("unbearbeitet")}
          style={{ flex: 1, padding: 8, borderRadius: 999,
            background: filter === "unbearbeitet" ? "#fff" : "transparent" }}>
          Unbearbeitet ({countUnbearbeitet})
        </button>

        <button onClick={() => setFilter("aktiv")}
          style={{ flex: 1, padding: 8, borderRadius: 999,
            background: filter === "aktiv" ? "#fff" : "transparent" }}>
          Aktiv ({countAktiv})
        </button>

        <button onClick={() => setFilter("alle")}
          style={{ flex: 1, padding: 8, borderRadius: 999,
            background: filter === "alle" ? "#fff" : "transparent" }}>
          Alle ({requests.length})
        </button>
      </div>

      {loading && <p>Wird geladen…</p>}

      {/* REQUESTS */}
      {!loading && filteredRequests.map((r) => {
        const status = STATUS_META[r._status];
        const sessionList = sessionsByRequest[String(r.id)] || [];

        return (
          <article key={r.id}
            style={{
              padding: 16,
              borderRadius: 16,
              border: "1px solid #ddd",
              marginBottom: 16,
              background: "#fff"
            }}>

            {/* HEADER */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: "0 0 4px" }}>{r.vorname} {r.nachname}</h3>
                <p style={{ margin: 0, fontSize: 13, color: "#777" }}>{r.email}</p>
              </div>

              <div style={{
                padding: "4px 10px",
                borderRadius: 999,
                background: status.bg,
                border: `1px solid ${status.border}`,
                color: status.text,
                fontSize: 12,
              }}>
                {status.label}
              </div>
            </div>

            {/* ANLIEGEN */}
            <p style={{ marginTop: 8 }}>
              <strong>Anliegen:</strong> {r.anliegen || "–"}
            </p>

            <button
              onClick={() => setDetailsModal(r)}
              style={{
                padding: "4px 10px",
                borderRadius: 8,
                background: "#f5f5f5",
                border: "1px solid #ccc",
                fontSize: 13,
              }}>
              Details anzeigen
            </button>

            {/* ACTIVE */}
            {r._status === "active" && (
              <>
                <p style={{ marginTop: 10 }}>
                  <strong>Stundensatz:</strong> {r.honorar_klient ? `${r.honorar_klient}€` : "–"}
                </p>

                {/* SESSIONS */}
                {sessionList.length > 0 && (
                  <div style={{
                    marginTop: 8,
                    background: "#F9F9FF",
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    padding: 10
                  }}>
                    <h4 style={{ marginTop: 0 }}>Sitzungen</h4>

                    {sessionList.map((s) => (
                      <div key={s.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "4px 0",
                          fontSize: 13
                        }}>
                        <span>{new Date(s.date).toLocaleString("de-AT")}</span>
                        <span>{s.duration_min} Min</span>
                        <span>{s.price.toFixed(2)} €</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button
                    onClick={() => { setSessionModal(r); setSessionDate(""); }}
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 999,
                      background: "rgba(150,170,255,0.25)",
                      border: "1px solid #9AAAF5",
                    }}>
                    ➕ nächste Sitzung
                  </button>

                  <button
                    onClick={() => finishCoaching(r)}
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: 999,
                      background: "#FFDADA",
                      border: "1px solid #E99999",
                    }}>
                    🔴 Coaching beenden
                  </button>
                </div>
              </>
            )}

            {/* UNBEARBEITET */}
            {UNBEARBEITET.includes(r._status) && (
              <>
                <div style={{
                  marginTop: 14,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap"
                }}>
                  <button
                    onClick={() => confirmAppointment(r)}
                    style={{
                      padding: "8px 12px",
                      background: "#D4F8D4",
                      border: "1px solid #88C688",
                      borderRadius: 999,
                    }}>
                    ✔ Termin bestätigen
                  </button>

                  <button
                    onClick={() => declineAppointment(r)}
                    style={{
                      padding: "8px 12px",
                      background: "#FFDADA",
                      border: "1px solid #E99999",
                      borderRadius: 999,
                    }}>
                    ✖ Absagen
                  </button>

                  <button
                    onClick={() => newAppointment(r)}
                    style={{
                      padding: "8px 12px",
                      background: "#E6E8FF",
                      border: "1px solid #9AAAF5",
                      borderRadius: 999,
                    }}>
                    🔁 Neuer Termin
                  </button>

                  <button
                    onClick={() => forwardRequest(r)}
                    style={{
                      padding: "8px 12px",
                      background: "#FFF1D6",
                      border: "1px solid #E0B96F",
                      borderRadius: 999,
                    }}>
                    👥 Weiterleiten
                  </button>
                </div>

                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      setMatchModal(r);
                      setMatchTarif(r.honorar_klient || "");
                      setMatchDate("");
                    }}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      background: "#D5F8D5",
                      border: "1px solid #88C688",
                      borderRadius: 999,
                    }}>
                    ❤️ Match
                  </button>

                  <button
                    onClick={() => noMatch(r)}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      background: "#FFE1E1",
                      border: "1px solid #E99999",
                      borderRadius: 999,
                    }}>
                    ❌ Kein Match
                  </button>
                </div>
              </>
            )}
          </article>
        );
      })}

      {/* MATCH MODAL */}
      {matchModal && (
        <Modal onClose={() => setMatchModal(null)}>
          <h3>Begleitung starten</h3>

          <label>Stundensatz (€)</label>
          <input
            type="number"
            value={matchTarif}
            onChange={(e) => setMatchTarif(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              marginTop: 4,
              borderRadius: 6,
              border: "1px solid #ddd",
            }}
          />

          <label style={{ marginTop: 12 }}>Erste Sitzung</label>
          <input
            type="datetime-local"
            value={matchDate}
            onChange={(e) => setMatchDate(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              marginTop: 4,
              borderRadius: 6,
              border: "1px solid #ddd",
            }}
          />

          <label style={{ marginTop: 12 }}>Dauer</label>
          <select
            value={matchDuration}
            onChange={(e) => setMatchDuration(Number(e.target.value))}
            style={{
              width: "100%",
              padding: 8,
              marginTop: 4,
              borderRadius: 6,
              border: "1px solid #ddd",
            }}
          >
            <option value={50}>50 Min</option>
            <option value={60}>60 Min</option>
            <option value={75}>75 Min</option>
          </select>

          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 16
          }}>
            <button
              onClick={() => setMatchModal(null)}
              style={{
                padding: "8px 14px",
                background: "#eee",
                borderRadius: 999,
                border: "1px solid #ccc",
              }}>
              Abbrechen
            </button>

            <button
              onClick={saveMatch}
              style={{
                padding: "8px 14px",
                background: "#D5F8D5",
                borderRadius: 999,
                border: "1px solid #88C688",
              }}>
              Speichern
            </button>
          </div>
        </Modal>
      )}

      {/* SITZUNG MODAL */}
      {sessionModal && (
        <Modal onClose={() => setSessionModal(null)}>
          <h3>Nächste Sitzung</h3>

          <label>Datum & Uhrzeit</label>
          <input
            type="datetime-local"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              marginTop: 4,
              borderRadius: 6,
              border: "1px solid #ddd",
            }}
          />

          <label style={{ marginTop: 12 }}>Dauer</label>
          <select
            value={sessionDuration}
            onChange={(e) => setSessionDuration(Number(e.target.value))}
            style={{
              width: "100%",
              padding: 8,
              marginTop: 4,
              borderRadius: 6,
              border: "1px solid #ddd",
            }}
          >
            <option value={50}>50 Min</option>
            <option value={60}>60 Min</option>
            <option value={75}>75 Min</option>
          </select>

          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 16
          }}>
            <button
              onClick={() => setSessionModal(null)}
              style={{
                padding: "8px 14px",
                background: "#eee",
                borderRadius: 999,
                border: "1px solid #ccc",
              }}>
              Abbrechen
            </button>

            <button
              onClick={saveSession}
              style={{
                padding: "8px 14px",
                background: "rgba(150,170,255,0.25)",
                borderRadius: 999,
                border: "1px solid #9AAAF5",
                color: "#304085",
                fontWeight: 600,
              }}>
              Speichern
            </button>
          </div>
        </Modal>
      )}

      {/* DETAILS MODAL */}
      {detailsModal && (
        <Modal onClose={() => setDetailsModal(null)}>
          <h3>Anfrage-Details</h3>

          <p><strong>Name:</strong> {detailsModal.vorname} {detailsModal.nachname}</p>
          <p><strong>E-Mail:</strong> {detailsModal.email}</p>
          <p><strong>Telefon:</strong> {detailsModal.telefon}</p>
          <p><strong>Adresse:</strong> {detailsModal.adresse}</p>

          <hr />

          <p><strong>Anliegen:</strong><br />{detailsModal.anliegen}</p>
          <p><strong>Leidensdruck:</strong> {detailsModal.leidensdruck}</p>
          <p><strong>Verlauf:</strong><br />{detailsModal.verlauf}</p>
          <p><strong>Diagnose:</strong> {detailsModal.diagnose}</p>
          <p><strong>Ziel:</strong><br />{detailsModal.ziel}</p>

          <div style={{ textAlign: "right", marginTop: 16 }}>
            <button
              onClick={() => setDetailsModal(null)}
              style={{
                padding: "8px 14px",
                background: "#eee",
                borderRadius: 999,
                border: "1px solid #ccc",
              }}>
              Schließen
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
