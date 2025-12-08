"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// ----------------------------------------
// STATUS-DEFINITIONEN (wir normalisieren auf diese Keys)
// ----------------------------------------
const STATUS_LABELS = {
  offen: "Offen",
  termin_bestaetigt: "Termin bestätigt",
  termin_neu: "Neuer Termin",
  weitergeleitet: "Weitergeleitet",
  active: "Begleitung aktiv",
  no_match: "Kein Match",
  finished: "Abgeschlossen",
};

const STATUS_COLORS = {
  offen: { bg: "#FFF7EC", border: "#E3C29A", text: "#8B5A2B" },
  termin_bestaetigt: { bg: "#EAF8EF", border: "#9AD0A0", text: "#2F6E3A" },
  termin_neu: { bg: "#EFF3FF", border: "#9AAAF5", text: "#304085" },
  weitergeleitet: { bg: "#F9F5FF", border: "#C8B0F5", text: "#54358B" },
  active: { bg: "#E2F7F0", border: "#79C2A1", text: "#1E6348" },
  no_match: { bg: "#FDECEC", border: "#F2A6A6", text: "#8B1E2B" },
  finished: { bg: "#EEEAFD", border: "#B6A6F2", text: "#3B2D7A" },
};

// Hilfsfunktion: rohen Status aus DB auf unsere Keys mappen
function normalizeStatus(raw) {
  if (!raw) return "offen";
  const s = String(raw).toLowerCase();

  if (s === "offen" || s === "neu") return "offen";
  if (s === "termin_bestaetigt") return "termin_bestaetigt";
  if (s === "termin_neu") return "termin_neu";
  if (s === "weitergeleitet") return "weitergeleitet";
  if (s === "active" || s === "aktiv") return "active";
  if (s === "no_match" || s === "kein_match") return "no_match";
  if (s === "finished" || s === "beendet") return "finished";

  return "offen";
}

// ----------------------------------------
// HAUPT-KOMPONENTE
// ----------------------------------------
export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("neu");
  const [loading, setLoading] = useState(true);

  // MATCH MODAL
  const [matchModal, setMatchModal] = useState(null);
  const [tarif, setTarif] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionDuration, setSessionDuration] = useState(60);

  // SESSION MODAL
  const [sessionModal, setSessionModal] = useState(null);

  // ----------------------------------------
  // LOGIN LADEN
  // ----------------------------------------
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });
  }, []);

  // ----------------------------------------
  // ANFRAGEN + SESSIONS LADEN
  // ----------------------------------------
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

      // Nicht-Admin: nur eigene Anfragen (per Mail im Feld wunschtherapeut)
      if (!isAdmin) {
        query = query.eq("wunschtherapeut", user.email);
      }

      const { data, error } = await query;

      if (error || !data) {
        console.error("Fehler beim Laden der Anfragen:", error);
        setRequests([]);
        setLoading(false);
        return;
      }

      // Zu jeder Anfrage die Sessions laden
      const withSessions = await Promise.all(
        data.map(async (req) => {
          const { data: sessions, error: sesErr } = await supabase
            .from("sessions")
            .select("*")
            .eq("anfrage_id", req.id)
            .order("date", { ascending: true });

          if (sesErr) {
            console.error("Fehler beim Laden der Sessions:", sesErr);
          }

          return { ...req, sessions: sessions || [] };
        })
      );

      setRequests(withSessions);
      setLoading(false);
    }

    load();
  }, [user]);

  // ----------------------------------------
  // API-AKTIONEN
  // ----------------------------------------
  async function confirmAppointment(req) {
    await fetch("/api/confirm-appointment", {
      method: "POST",
      body: JSON.stringify({
        requestId: req.id,
        therapist: user.email,
        client: req.email,
        slot: req.bevorzugte_zeit || req.bevorzugt || "",
      }),
    });
    alert("Termin bestätigt.");
    window.location.reload();
  }

  async function decline(req) {
    await fetch("/api/reject-appointment", {
      method: "POST",
      body: JSON.stringify({
        requestId: req.id,
        therapist: user.email,
        client: req.email,
        vorname: req.vorname,
      }),
    });
    alert("Absage gesendet.");
    window.location.reload();
  }

  async function newAppointment(req) {
    await fetch("/api/new-appointment", {
      method: "POST",
      body: JSON.stringify({
        requestId: req.id,
        client: req.email,
        therapistEmail: user.email,
        therapistName: req.wunschtherapeut,
        vorname: req.vorname,
      }),
    });
    alert("Neuer Terminauswahl-Link gesendet.");
    window.location.reload();
  }

  async function reassign(req) {
    await fetch("/api/forward-request", {
      method: "POST",
      body: JSON.stringify({
        requestId: req.id,
        client: req.email,
        vorname: req.vorname,
      }),
    });
    alert("Anfrage weitergeleitet.");
    window.location.reload();
  }

  async function noMatch(req) {
    await fetch("/api/no-match", {
      method: "POST",
      body: JSON.stringify({ anfrageId: req.id }),
    });
    alert("Kein Match gespeichert.");
    window.location.reload();
  }

  async function saveMatch() {
    if (!tarif || !sessionDate) {
      alert("Bitte Stundensatz und ersten Termin eintragen.");
      return;
    }

    await fetch("/api/match-client", {
      method: "POST",
      body: JSON.stringify({
        anfrageId: matchModal.id,
        honorar_klient: Number(tarif),
        therapistEmail: user.email,
        nextDate: sessionDate,
        duration: sessionDuration,
      }),
    });

    alert("Begleitung gestartet.");
    window.location.reload();
  }

  async function saveSession() {
    if (!sessionDate) {
      alert("Bitte Datum für die Sitzung angeben.");
      return;
    }

    await fetch("/api/add-session", {
      method: "POST",
      body: JSON.stringify({
        anfrageId: sessionModal.id,
        therapist: user.email,
        date: sessionDate,
        duration: sessionDuration,
      }),
    });

    alert("Sitzung gespeichert.");
    window.location.reload();
  }

  async function finishCoaching(req) {
    await fetch("/api/finish-coaching", {
      method: "POST",
      body: JSON.stringify({ anfrageId: req.id }),
    });

    alert("Coaching beendet.");
    window.location.reload();
  }

  // ----------------------------------------
  // FILTERLOGIK
  // ----------------------------------------
  const normalizedRequests = requests.map((r) => ({
    ...r,
    _status: normalizeStatus(r.status),
  }));

  const filteredRequests = normalizedRequests.filter((r) => {
    const s = r._status;

    if (filter === "neu") {
      // alles, was noch in der Erstgesprächsphase ist
      return ["offen", "termin_neu", "termin_bestaetigt", "weitergeleitet"].includes(
        s
      );
    }

    if (filter === "bearbeitet") {
      return !["offen", "termin_neu", "termin_bestaetigt", "weitergeleitet"].includes(
        s
      );
    }

    return true; // alle
  });

  const countNeu = normalizedRequests.filter((r) =>
    ["offen", "termin_neu", "termin_bestaetigt", "weitergeleitet"].includes(
      r._status
    )
  ).length;

  const countBearbeitet = normalizedRequests.length - countNeu;

  // ----------------------------------------
  // ABRECHNUNG (A) + MONATSSTATISTIK (B) für Admin
  // ----------------------------------------
  const isAdmin = user?.email?.toLowerCase() === "hallo@mypoise.de";

  const allSessions = normalizedRequests.flatMap((r) =>
    (r.sessions || []).map((s) => ({
      ...s,
      therapist: s.therapist || r.wunschtherapeut || "",
    }))
  );

  const totalUmsatz = allSessions.reduce((sum, s) => sum + (s.price || 0), 0);
  const totalProvision = allSessions.reduce(
    (sum, s) => sum + (s.commission || 0),
    0
  );
  const totalAuszahlung = allSessions.reduce(
    (sum, s) => sum + (s.payout || 0),
    0
  );

  const perMonth = {};
  allSessions.forEach((s) => {
    if (!s.date) return;
    const d = new Date(s.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    if (!perMonth[key]) {
      perMonth[key] = { umsatz: 0, provision: 0, auszahlung: 0 };
    }
    perMonth[key].umsatz += s.price || 0;
    perMonth[key].provision += s.commission || 0;
    perMonth[key].auszahlung += s.payout || 0;
  });

  // ----------------------------------------
  // UI
  // ----------------------------------------
  if (!user)
    return <div style={{ padding: 40 }}>Bitte per Magic Link einloggen…</div>;

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 960,
        margin: "0 auto",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* HEADER */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>Poise Dashboard</h1>
          <p style={{ margin: "6px 0 0", color: "#666" }}>
            Eingeloggt als <strong>{user.email}</strong>
            {isAdmin && " · Admin-Ansicht"}
          </p>
        </div>

        {/* FILTER */}
        <div
          style={{
            display: "flex",
            background: "#F4ECE4",
            borderRadius: 999,
            padding: 4,
            gap: 4,
            minWidth: 260,
          }}
        >
          <button
            type="button"
            onClick={() => setFilter("neu")}
            style={{
              flex: 1,
              borderRadius: 999,
              border: "none",
              padding: "6px 12px",
              cursor: "pointer",
              background: filter === "neu" ? "#fff" : "transparent",
              fontWeight: filter === "neu" ? 600 : 400,
            }}
          >
            Neu ({countNeu})
          </button>
          <button
            type="button"
            onClick={() => setFilter("bearbeitet")}
            style={{
              flex: 1,
              borderRadius: 999,
              border: "none",
              padding: "6px 12px",
              cursor: "pointer",
              background: filter === "bearbeitet" ? "#fff" : "transparent",
              fontWeight: filter === "bearbeitet" ? 600 : 400,
            }}
          >
            Bearbeitet ({countBearbeitet})
          </button>
          <button
            type="button"
            onClick={() => setFilter("alle")}
            style={{
              flex: 1,
              borderRadius: 999,
              border: "none",
              padding: "6px 12px",
              cursor: "pointer",
              background: filter === "alle" ? "#fff" : "transparent",
              fontWeight: filter === "alle" ? 600 : 400,
            }}
          >
            Alle ({normalizedRequests.length})
          </button>
        </div>
      </header>

      {/* ADMIN-ABRECHNUNG (A + B) */}
      {isAdmin && (
        <section
          style={{
            marginBottom: 24,
            padding: 16,
            borderRadius: 12,
            border: "1px solid #e5e5e5",
            background: "#FBF7F3",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Abrechnung (gesamt)</h2>
          <p>Umsatz: {totalUmsatz.toFixed(2)} €</p>
          <p>Provision (30%): {totalProvision.toFixed(2)} €</p>
          <p>Auszahlung: {totalAuszahlung.toFixed(2)} €</p>

          <h3 style={{ marginTop: 16, fontSize: 16 }}>Monatsübersicht</h3>
          {Object.keys(perMonth).length === 0 && (
            <p style={{ color: "#777" }}>Noch keine Sitzungen erfasst.</p>
          )}
          {Object.entries(perMonth).map(([month, v]) => (
            <div key={month} style={{ fontSize: 14, marginBottom: 6 }}>
              <strong>{month}</strong>: Umsatz {v.umsatz.toFixed(2)} € ·
              Provision {v.provision.toFixed(2)} € · Auszahlung{" "}
              {v.auszahlung.toFixed(2)} €
            </div>
          ))}
        </section>
      )}

      {/* ANFRAGENLISTE */}
      {loading && <p>Wird geladen…</p>}

      {!loading && filteredRequests.length === 0 && (
        <p style={{ color: "#777" }}>Keine Anfragen im aktuellen Filter.</p>
      )}

      {!loading &&
        filteredRequests.map((r) => {
          const statusKey = r._status;
          const colors = STATUS_COLORS[statusKey] || STATUS_COLORS.offen;

          return (
            <article
              key={r.id}
              style={{
                padding: 18,
                borderRadius: 12,
                border: "1px solid #e5e5e5",
                marginBottom: 14,
                background: "#fff",
              }}
            >
              {/* HEADER PRO KLIENT:IN */}
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

                {/* STATUS-BADGE */}
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
                  <span>{STATUS_LABELS[statusKey]}</span>
                </div>
              </div>

              {/* ANLIEGEN KURZ */}
              {r.anliegen && (
                <p
                  style={{
                    margin: "8px 0 10px",
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Anliegen:</strong> {r.anliegen}
                </p>
              )}

              {/* ERSTGESPRÄCHS-PHASE */}
              {["offen", "termin_neu", "termin_bestaetigt", "weitergeleitet"].includes(
                statusKey
              ) && (
                <div
                  style={{
                    marginTop: 4,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => confirmAppointment(r)}
                  >
                    ✔ Termin bestätigen
                  </button>

                  <button type="button" onClick={() => decline(r)}>
                    ✖ Absagen
                  </button>

                  <button type="button" onClick={() => newAppointment(r)}>
                    🔁 Neuer Termin
                  </button>

                  <button type="button" onClick={() => reassign(r)}>
                    👥 Weiterleiten
                  </button>

                  <button type="button" onClick={() => setMatchModal(r)}>
                    💚 Match
                  </button>

                  <button type="button" onClick={() => noMatch(r)}>
                    ❌ Kein Match
                  </button>
                </div>
              )}

              {/* COACHING-PHASE */}
              {statusKey === "active" && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ marginBottom: 8 }}>
                    <strong>Stundensatz:</strong>{" "}
                    {r.honorar_klient
                      ? `${r.honorar_klient} €`
                      : "– (kein Honorar gespeichert)"}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setSessionModal(r);
                      setSessionDate("");
                      setSessionDuration(60);
                    }}
                  >
                    ➕ nächste Sitzung
                  </button>

                  <button
                    type="button"
                    onClick={() => finishCoaching(r)}
                    style={{
                      marginLeft: 8,
                      background: "#FDD",
                    }}
                  >
                    🔴 Coaching beenden
                  </button>
                </div>
              )}

              {/* ABGESCHLOSSEN / KEIN MATCH */}
              {statusKey === "finished" && (
                <p style={{ marginTop: 10, color: "#555" }}>
                  Coaching wurde abgeschlossen.
                </p>
              )}

              {statusKey === "no_match" && (
                <p style={{ marginTop: 10, color: "#a33" }}>
                  Kein Match – Anfrage abgeschlossen.
                </p>
              )}

              {/* SITZUNGSLISTE */}
              {r.sessions && r.sessions.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h4 style={{ marginBottom: 8 }}>Bisherige Sitzungen</h4>

                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #eee",
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    {r.sessions.map((s, idx) => (
                      <div
                        key={s.id || idx}
                        style={{
                          padding: "6px 0",
                          borderBottom:
                            idx === r.sessions.length - 1
                              ? "none"
                              : "1px solid #eee",
                        }}
                      >
                        <div style={{ fontSize: 14 }}>
                          <strong>
                            {s.date
                              ? new Date(s.date).toLocaleString("de-AT")
                              : "ohne Datum"}
                          </strong>{" "}
                          · {s.duration_min} Min
                        </div>

                        <div style={{ fontSize: 13, color: "#444" }}>
                          Honorar: {Number(s.price || 0).toFixed(2)} € •
                          Provision: {Number(s.commission || 0).toFixed(2)} € •
                          Auszahlung: {Number(s.payout || 0).toFixed(2)} €
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}

      {/* MATCH MODAL */}
      {matchModal && (
        <Modal>
          <h3>Begleitung starten</h3>

          <label style={{ fontSize: 13, marginTop: 8 }}>
            Stundensatz (€)
          </label>
          <input
            type="number"
            value={tarif}
            onChange={(e) => setTarif(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />

          <label style={{ fontSize: 13 }}>Erste Sitzung</label>
          <input
            type="datetime-local"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />

          <label style={{ fontSize: 13 }}>Dauer</label>
          <select
            value={sessionDuration}
            onChange={(e) =>
              setSessionDuration(Number(e.target.value))
            }
            style={{ width: "100%", marginBottom: 16 }}
          >
            <option value={50}>50 Minuten</option>
            <option value={60}>60 Minuten</option>
            <option value={75}>75 Minuten</option>
          </select>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="button" onClick={saveMatch}>
              Speichern
            </button>
            <button
              type="button"
              onClick={() => {
                setMatchModal(null);
                setTarif("");
                setSessionDate("");
              }}
              style={{ background: "#eee" }}
            >
              Abbrechen
            </button>
          </div>
        </Modal>
      )}

      {/* SESSION MODAL */}
      {sessionModal && (
        <Modal>
          <h3>Nächste Sitzung</h3>

          <label style={{ fontSize: 13, marginTop: 8 }}>Datum</label>
          <input
            type="datetime-local"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />

          <label style={{ fontSize: 13 }}>Dauer</label>
          <select
            value={sessionDuration}
            onChange={(e) =>
              setSessionDuration(Number(e.target.value))
            }
            style={{ width: "100%", marginBottom: 16 }}
          >
            <option value={50}>50 Minuten</option>
            <option value={60}>60 Minuten</option>
            <option value={75}>75 Minuten</option>
          </select>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="button" onClick={saveSession}>
              Speichern
            </button>
            <button
              type="button"
              onClick={() => {
                setSessionModal(null);
                setSessionDate("");
              }}
              style={{ background: "#eee" }}
            >
              Abbrechen
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ----------------------------------------
// MODAL KOMPONENTE
// ----------------------------------------
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
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 18,
          borderRadius: 12,
          width: "100%",
          maxWidth: 380,
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
