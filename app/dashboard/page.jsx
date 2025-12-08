"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// ---------------------------------------------------------
// STATUS LABELLING
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
// MAIN COMPONENT
// ---------------------------------------------------------
export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState("unbearbeitet");

  // Modal states
  const [matchModal, setMatchModal] = useState(null);
  const [sessionModal, setSessionModal] = useState(null);

  // Form states
  const [tarif, setTarif] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionDuration, setSessionDuration] = useState(60);

  // -----------------------------------------------------
  // Load logged user
  // -----------------------------------------------------
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    }
    loadUser();
  }, []);

  // -----------------------------------------------------
  // Load requests + sessions
  // -----------------------------------------------------
  useEffect(() => {
    if (!user?.email) return;

    async function load() {
      const email = user.email.toLowerCase();

      let query = supabase.from("anfragen").select("*").order("id", {
        ascending: false,
      });

      // Admin sees all
      if (email !== "hallo@mypoise.de") {
        query = query.eq("wunschtherapeut", user.email);
      }

      const { data: req, error } = await query;
      if (!error) setRequests(req || []);

      // load sessions
      const { data: sess } = await supabase
        .from("sessions")
        .select("*")
        .order("date", { ascending: true });

      setSessions(sess || []);
    }

    load();
  }, [user]);

  // -----------------------------------------------------
  // Normalize requests with sessions
  // -----------------------------------------------------
  const normalizedRequests = requests.map((r) => {
    const sess = sessions.filter((s) => Number(s.anfrage_id) === Number(r.id));
    return { ...r, _sessions: sess, _status: r.status || "offen" };
  });

  // -----------------------------------------------------
  // FILTER
  // -----------------------------------------------------
  const filteredRequests = normalizedRequests.filter((r) => {
    const s = r._status;

    if (filter === "unbearbeitet") {
      return ["offen", "termin_neu", "termin_bestaetigt", "weitergeleitet"].includes(s);
    }

    if (filter === "active") return s === "active";

    return true; // all
  });

  // -----------------------------------------------------
  // API ACTIONS
  // -----------------------------------------------------
  async function saveMatch() {
    if (!matchModal) return;

    const { id } = matchModal;

    const { error } = await supabase
      .from("anfragen")
      .update({
        status: "active",
        honorar_klient: tarif,
      })
      .eq("id", id);

    if (error) {
      alert("Fehler beim Match!");
      return;
    }

    // erste Sitzung speichern
    await supabase.from("sessions").insert({
      anfrage_id: id,
      therapist: user.email,
      date: sessionDate,
      price: tarif,
      commission: tarif * 0.3,
      payout: tarif * 0.7,
      duration_min: sessionDuration,
    });

    alert("Begleitung gestartet!");
    window.location.reload();
  }

  async function saveSession() {
    if (!sessionModal) return;

    const { id, honorar_klient } = sessionModal;

    await supabase.from("sessions").insert({
      anfrage_id: id,
      therapist: user.email,
      date: sessionDate,
      price: honorar_klient,
      commission: honorar_klient * 0.3,
      payout: honorar_klient * 0.7,
      duration_min: sessionDuration,
    });

    alert("Sitzung gespeichert!");
    window.location.reload();
  }

  async function endCoaching(req) {
    await supabase.from("anfragen").update({ status: "beendet" }).eq("id", req.id);
    alert("Coaching beendet.");
    window.location.reload();
  }

  // -----------------------------------------------------
  // UI
  // -----------------------------------------------------
  if (!user) return <div style={{ padding: 30 }}>Bitte einloggen…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>Poise Dashboard</h1>

      {/* FILTER */}
      <div
        style={{
          display: "flex",
          gap: 6,
          background: "#F4ECE4",
          padding: 4,
          borderRadius: 999,
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          onClick={() => setFilter("unbearbeitet")}
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: 999,
            background: filter === "unbearbeitet" ? "#fff" : "transparent",
          }}
        >
          Unbearbeitet
        </button>

        <button
          type="button"
          onClick={() => setFilter("active")}
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: 999,
            background: filter === "active" ? "#fff" : "transparent",
          }}
        >
          Aktiv
        </button>

        <button
          type="button"
          onClick={() => setFilter("alle")}
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: 999,
            background: filter === "alle" ? "#fff" : "transparent",
          }}
        >
          Alle
        </button>
      </div>

      {/* REQUEST LIST */}
      {filteredRequests.map((r) => {
        const colors = STATUS_COLORS[r._status] || STATUS_COLORS.offen;

        return (
          <div
            key={r.id}
            style={{
              padding: 16,
              border: "1px solid #ddd",
              borderRadius: 12,
              marginBottom: 16,
              background: "#fff",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>
                {r.vorname} {r.nachname}
              </strong>

              <div
                style={{
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  padding: "2px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                }}
              >
                {STATUS_LABELS[r._status]}
              </div>
            </div>

            <div style={{ color: "#777", fontSize: 13 }}>
              {r.email} · Wunsch: {r.wunschtherapeut}
            </div>

            {r.anliegen && (
              <p style={{ marginTop: 8 }}>
                <strong>Anliegen:</strong> {r.anliegen}
              </p>
            )}

            {/* ACTIVE COACHING UI */}
            {r._status === "active" && (
              <>
                <p style={{ marginTop: 8 }}>
                  <strong>Stundensatz:</strong>{" "}
                  {r.honorar_klient ? `${r.honorar_klient} €` : "– (kein Honorar gespeichert)"}
                </p>

                {/* Sessions List */}
                {r._sessions.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <strong>Sitzungen:</strong>
                    {r._sessions.map((s) => (
                      <div key={s.id} style={{ marginTop: 6 }}>
                        ● {new Date(s.date).toLocaleString()} — {s.duration_min} min — {s.price} €
                      </div>
                    ))}
                  </div>
                )}

                {/* Buttons */}
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setSessionModal(r)}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: "#e8f0ff",
                    }}
                  >
                    + nächste Sitzung
                  </button>

                  <button
                    type="button"
                    onClick={() => endCoaching(r)}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: "#ffdada",
                    }}
                  >
                    Coaching beenden
                  </button>
                </div>
              </>
            )}

            {/* UNBEARBEITETE / ERSTGESPRÄCH */}
            {r._status !== "active" && (
              <>
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setMatchModal(r)}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: "#d4f8d4",
                    }}
                  >
                    ❤️ Match
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await supabase.from("anfragen").update({ status: "kein_match" }).eq("id", r.id);
                      window.location.reload();
                    }}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      background: "#ffdada",
                    }}
                  >
                    ✖ Kein Match
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* MATCH MODAL */}
      {matchModal && (
        <Modal>
          <h3>Begleitung starten</h3>

          <label>Stundensatz (€)</label>
          <input type="number" value={tarif} onChange={(e) => setTarif(e.target.value)} />

          <label style={{ marginTop: 12 }}>Erste Sitzung</label>
          <input
            type="datetime-local"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
          />

          <label style={{ marginTop: 12 }}>Dauer</label>
          <select
            value={sessionDuration}
            onChange={(e) => setSessionDuration(Number(e.target.value))}
          >
            <option value={50}>50 Minuten</option>
            <option value={60}>60 Minuten</option>
            <option value={75}>75 Minuten</option>
          </select>

          <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
            <button type="button" onClick={saveMatch}>
              Speichern
            </button>
            <button type="button" onClick={() => setMatchModal(null)}>
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

          <label style={{ marginTop: 12 }}>Dauer</label>
          <select
            value={sessionDuration}
            onChange={(e) => setSessionDuration(Number(e.target.value))}
          >
            <option value={50}>50 Minuten</option>
            <option value={60}>60 Minuten</option>
            <option value={75}>75 Minuten</option>
          </select>

          <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
            <button type="button" onClick={saveSession}>
              Speichern
            </button>
            <button type="button" onClick={() => setSessionModal(null)}>
              Abbrechen
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// MODAL UI
// ---------------------------------------------------------
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
        padding: 20,
        zIndex: 9999,
      }}
    >
      <div style={{ background: "#fff", padding: 20, borderRadius: 12, width: "100%", maxWidth: 360 }}>
        {children}
      </div>
    </div>
  );
}
