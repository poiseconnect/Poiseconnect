"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// ----------------------------------------
// STATUS-DEFINITIONEN
// ----------------------------------------
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

      const isAdmin = user.email.toLowerCase() === "hallo@mypoise.de";

      let query = supabase
        .from("anfragen")
        .select("*")
        .order("id", { ascending: false });

      if (!isAdmin) {
        query = query.eq("wunschtherapeut", user.email);
      }

      const { data, error } = await query;

      if (error || !data) {
        setRequests([]);
        setLoading(false);
        return;
      }

      const withSessions = await Promise.all(
        data.map(async (req) => {
          const { data: sessions } = await supabase
            .from("sessions")
            .select("*")
            .eq("anfrage_id", req.id)
            .order("date", { ascending: true });

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
        slot: req.bevorzugte_zeit,
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
      alert("Bitte Tarif und Termin eintragen.");
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
      alert("Bitte Datum angeben.");
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
  const filteredRequests = requests.filter((r) => {
    const status = r.status || "neu";
    if (filter === "neu")
      return ["neu", "termin_neu", "termin_bestaetigt"].includes(status);
    if (filter === "bearbeitet")
      return !["neu", "termin_neu", "termin_bestaetigt"].includes(status);
    return true;
  });

  const countNeu = requests.filter((r) =>
    ["neu", "termin_neu", "termin_bestaetigt"].includes(r.status || "neu")
  ).length;

  const countBearbeitet = requests.length - countNeu;

  // ----------------------------------------
  // BERECHNUNG FÜR ADMIN (A + B)
  // ----------------------------------------
  const isAdmin = user?.email?.toLowerCase() === "hallo@mypoise.de";

  const abrechnung = requests.flatMap((r) => r.sessions);

  const totalUmsatz = abrechnung.reduce((s, x) => s + (x.price || 0), 0);
  const totalProvision = abrechnung.reduce((s, x) => s + (x.commission || 0), 0);
  const totalAuszahlung = abrechnung.reduce((s, x) => s + (x.payout || 0), 0);

  // Monatsstatistik
  const groupedByMonth = {};
  abrechnung.forEach((s) => {
    const d = new Date(s.date);
    const key = `${d.getFullYear()}-${(d.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;

    if (!groupedByMonth[key]) {
      groupedByMonth[key] = { umsatz: 0, provision: 0, auszahlung: 0 };
    }

    groupedByMonth[key].umsatz += s.price;
    groupedByMonth[key].provision += s.commission;
    groupedByMonth[key].auszahlung += s.payout;
  });

  // ----------------------------------------
  // UI
  // ----------------------------------------
  if (!user)
    return <div style={{ padding: 40 }}>Bitte per Magic Link einloggen…</div>;

  return (
    <div style={{ padding: 40, maxWidth: 960, margin: "0 auto" }}>
      <h1>Poise Dashboard</h1>
      <p>Eingeloggt als: <strong>{user.email}</strong></p>

      {/* ADMIN ABRECHNUNG */}
      {isAdmin && (
        <div
          style={{
            margin: "20px 0",
            padding: 20,
            border: "1px solid #ddd",
            borderRadius: 12,
            background: "#fafafa",
          }}
        >
          <h2>📊 Gesamt-Abrechnung</h2>
          <p>Umsatz: {totalUmsatz.toFixed(2)} €</p>
          <p>Provision: {totalProvision.toFixed(2)} €</p>
          <p>Auszahlung: {totalAuszahlung.toFixed(2)} €</p>

          <h3 style={{ marginTop: 20 }}>📅 Monatliche Statistik</h3>
          {Object.entries(groupedByMonth).map(([month, data]) => (
            <div key={month} style={{ marginBottom: 10 }}>
              <strong>{month}</strong><br />
              Umsatz: {data.umsatz.toFixed(2)} € |
              Provision: {data.provision.toFixed(2)} € |
              Auszahlung: {data.auszahlung.toFixed(2)} €
            </div>
          ))}
        </div>
      )}

      {/* FILTER */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          background: "#F4ECE4",
          padding: 4,
          borderRadius: 999,
        }}
      >
        <button type="button" onClick={() => setFilter("neu")}
          style={{ flex: 1, background: filter === "neu" ? "#fff" : "transparent" }}>
          Neu ({countNeu})
        </button>

        <button type="button" onClick={() => setFilter("bearbeitet")}
          style={{ flex: 1, background: filter === "bearbeitet" ? "#fff" : "transparent" }}>
          Bearbeitet ({countBearbeitet})
        </button>

        <button type="button" onClick={() => setFilter("alle")}
          style={{ flex: 1, background: filter === "alle" ? "#fff" : "transparent" }}>
          Alle ({requests.length})
        </button>
      </div>

      {/* LISTE */}
      {!loading &&
        filteredRequests.map((r) => {
          const status = r.status || "neu";
          const c = STATUS_COLORS[status];

          return (
            <div
              key={r.id}
              style={{
                padding: 20,
                border: "1px solid #ddd",
                borderRadius: 12,
                marginBottom: 20,
              }}
            >
              <h3>{r.vorname} {r.nachname}</h3>
              <p>{r.email}</p>

              <span
                style={{
                  background: c.bg,
                  color: c.text,
                  border: `1px solid ${c.border}`,
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 12,
                }}
              >
                {STATUS_LABELS[status]}
              </span>

              {/* Erstgespräch */}
              {["neu","termin_neu","termin_bestaetigt","weitergeleitet"].includes(status) && (
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => confirmAppointment(r)}>✔ Termin bestätigen</button>
                  <button type="button" onClick={() => decline(r)}>✖ Absagen</button>
                  <button type="button" onClick={() => newAppointment(r)}>🔁 Neuer Termin</button>
                  <button type="button" onClick={() => reassign(r)}>👥 Weiterleiten</button>
                  <button type="button" onClick={() => setMatchModal(r)}>💚 Match</button>
                  <button type="button" onClick={() => noMatch(r)}>❌ Kein Match</button>
                </div>
              )}

              {/* Coaching aktiv */}
              {status === "active" && (
                <div style={{ marginTop: 14 }}>
                  <p><strong>Stundensatz:</strong> {r.honorar_klient} €</p>
                  <button type="button" onClick={() => setSessionModal(r)}>➕ nächste Sitzung</button>
                  <button type="button" onClick={() => finishCoaching(r)} style={{ marginLeft: 8, background: "#FDD" }}>🔴 Coaching beenden</button>
                </div>
              )}

              {/* Sitzungen */}
              {r.sessions.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h4>🗂 Sitzungen</h4>
                  {r.sessions.map((s) => (
                    <div key={s.id} style={{ marginBottom: 10 }}>
                      <strong>{new Date(s.date).toLocaleString("de-AT")}</strong>  
                      • {s.duration_min} Min  
                      <br />
                      Honorar: {s.price.toFixed(2)} €  
                      • Provision: {s.commission.toFixed(2)} €  
                      • Auszahlung: {s.payout.toFixed(2)} €
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

      {/* MATCH MODAL */}
      {matchModal && (
        <Modal>
          <h3>Begleitung starten</h3>

          <label>Stundensatz (€)</label>
          <input
            type="number"
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

          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={saveMatch}>Speichern</button>
            <button type="button" onClick={() => setMatchModal(null)} style={{ marginLeft: 8 }}>
              Abbrechen
            </button>
          </div>
        </Modal>
      )}

      {/* SESSION MODAL */}
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

          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={saveSession}>Speichern</button>
            <button type="button" onClick={() => setSessionModal(null)} style={{ marginLeft: 8 }}>
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
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 12,
          width: "90%",
          maxWidth: 380,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
