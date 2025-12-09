"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// -------------------------
// STATUS NORMALISIERUNG
// -------------------------
function normalizeStatus(raw) {
  if (!raw) return "offen";

  let s = String(raw).toLowerCase().trim();

  // Supabase speichert manchmal "'offen'::text"
  s = s.replace(/['"]+/g, "").replace("::text", "").trim();

  if (["neu", "new", "offen", ""].includes(s)) return "offen";
  if (["termin_neu", "new_appointment"].includes(s)) return "termin_neu";
  if (["termin_bestaetigt", "confirmed"].includes(s))
    return "termin_bestaetigt";
  if (["weitergeleitet", "forwarded"].includes(s)) return "weitergeleitet";
  if (["active", "aktiv"].includes(s)) return "active";
  if (["beendet", "finished", "closed"].includes(s)) return "beendet";
  if (["kein_match", "nomatch", "no_match"].includes(s)) return "kein_match";

  return "offen";
}

// -------------------------
// STATUS BADGES
// -------------------------
const STATUS_BADGES = {
  offen: { bg: "#FFF7EC", border: "#E3C29A", text: "#8B5A2B", label: "Neu" },
  termin_neu: {
    bg: "#EFF3FF",
    border: "#9AAAF5",
    text: "#304085",
    label: "Neuer Termin",
  },
  termin_bestaetigt: {
    bg: "#EAF8EF",
    border: "#9AD0A0",
    text: "#2F6E3A",
    label: "Termin bestätigt",
  },
  weitergeleitet: {
    bg: "#F4EFFF",
    border: "#C9B0FF",
    text: "#5E3EA8",
    label: "Weitergeleitet",
  },
  active: {
    bg: "#E8FFF0",
    border: "#90D5A0",
    text: "#2D7A45",
    label: "Begleitung aktiv",
  },
  kein_match: {
    bg: "#FFECEC",
    border: "#F2A5A5",
    text: "#9B1C2C",
    label: "Kein Match",
  },
  beendet: {
    bg: "#F0F0F0",
    border: "#CCCCCC",
    text: "#666",
    label: "Beendet",
  },
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [sessions, setSessions] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("aktiv"); // unb, aktiv, alle
  const [detailsOpen, setDetailsOpen] = useState(null);

  // -------------------------
  // LOGIN CHECK
  // -------------------------
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    }
    loadUser();
  }, []);

  // -------------------------
  // ANFRAGEN LADEN
  // -------------------------
  useEffect(() => {
    if (!user?.email) return;

    async function load() {
      setLoading(true);
      let query = supabase.from("anfragen").select("*").order("id", { ascending: false });

      if (user.email.toLowerCase() !== "hallo@mypoise.de") {
        query = query.eq("wunschtherapeut", user.email);
      }

      const { data, error } = await query;

      if (error) {
        console.error(error);
        setRequests([]);
      } else {
        const normalized = data.map((r) => ({
          ...r,
          _status: normalizeStatus(r.status),
        }));
        setRequests(normalized);
      }

      setLoading(false);
    }

    load();
  }, [user]);

  // -------------------------
  // SESSIONS LADEN
  // -------------------------
  useEffect(() => {
    async function loadSessions() {
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .order("date", { ascending: true });

      if (!data) return;

      const grouped = {};
      data.forEach((s) => {
        if (!grouped[s.anfrage_id]) grouped[s.anfrage_id] = [];
        grouped[s.anfrage_id].push(s);
      });

      setSessions(grouped);
    }

    loadSessions();
  }, []);

  // -------------------------
  // API FUNKTIONEN
  // -------------------------
  async function handleMatch(req) {
    const honorar = prompt("Bitte Honorar pro Stunde (€) eingeben:");
    if (!honorar) return;

    const nextDate = new Date().toISOString();
    const duration = 60;

    const res = await fetch("/api/match-client", {
      method: "POST",
      body: JSON.stringify({
        anfrageId: req.id,
        honorar,
        therapistEmail: user.email,
        nextDate,
        duration,
      }),
    });

    if (!res.ok) return alert("Fehler!");
    alert("Begleitung gestartet.");
    location.reload();
  }

  async function handleNoMatch(req) {
    const res = await fetch("/api/no-match", {
      method: "POST",
      body: JSON.stringify({ anfrageId: req.id }),
    });
    if (!res.ok) return alert("Fehler!");
    alert("Kein Match eingetragen");
    location.reload();
  }

  async function addSession(req) {
    const date = prompt("Datum neue Sitzung (YYYY-MM-DD HH:MM):");
    if (!date) return;

    const duration = 60;

    const res = await fetch("/api/add-session", {
      method: "POST",
      body: JSON.stringify({
        anfrageId: req.id,
        therapist: user.email,
        date,
        duration,
      }),
    });

    if (!res.ok) return alert("Fehler!");
    alert("Sitzung hinzugefügt.");
    location.reload();
  }

  async function finishCoaching(req) {
    const res = await fetch("/api/finish-coaching", {
      method: "POST",
      body: JSON.stringify({ anfrageId: req.id }),
    });

    if (!res.ok) return alert("Fehler!");
    alert("Coaching beendet.");
    location.reload();
  }

  // -------------------------
  // FILTER
  // -------------------------
  const filtered = requests.filter((r) => {
    if (filter === "aktiv") return r._status === "active";
    if (filter === "unbearbeitet") return r._status === "offen";
    return true;
  });

  // -------------------------
  // UI RENDERING
  // -------------------------
  if (!user) return <div style={{ padding: 40 }}>Bitte per Magic Link einloggen…</div>;

  return (
    <div style={{ padding: 30, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 34, fontWeight: 700 }}>Poise Dashboard</h1>

      {/* FILTER */}
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
          }}
        >
          Unbearbeitet ({requests.filter((r) => r._status === "offen").length})
        </button>

        <button
          onClick={() => setFilter("aktiv")}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 999,
            border: "none",
            background: filter === "aktiv" ? "#fff" : "transparent",
          }}
        >
          Aktiv ({requests.filter((r) => r._status === "active").length})
        </button>

        <button
          onClick={() => setFilter("alle")}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 999,
            border: "none",
            background: filter === "alle" ? "#fff" : "transparent",
          }}
        >
          Alle ({requests.length})
        </button>
      </div>

      {filtered.map((r) => {
        const badge = STATUS_BADGES[r._status];

        return (
          <div
            key={r.id}
            style={{
              border: "1px solid #ddd",
              background: "#fff",
              padding: 16,
              borderRadius: 16,
              marginBottom: 18,
            }}
          >
            {/* NAME + BADGE */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0 }}>
                {r.vorname?.slice(0, 1)} {r.nachname?.slice(0, 1)}
              </h3>

              <div
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: badge.bg,
                  border: `1px solid ${badge.border}`,
                  color: badge.text,
                  fontSize: 12,
                }}
              >
                {badge.label}
              </div>
            </div>

            {/* EMAIL + WUNSCH */}
            <p style={{ margin: "2px 0", color: "#777" }}>
              {r.email} · Wunsch: {r.wunschtherapeut || "-"}
            </p>

            {/* ANLIEGEN */}
            <p style={{ fontSize: 14, marginTop: 4 }}>
              <strong>Anliegen:</strong> {r.anliegen || "-"}
            </p>

            {/* DETAILS BUTTON */}
            <button
              onClick={() => setDetailsOpen(detailsOpen === r.id ? null : r.id)}
              style={{
                marginTop: 4,
                padding: "4px 10px",
                borderRadius: 8,
                background: "#eee",
                border: "1px solid #ccc",
              }}
            >
              Details anzeigen
            </button>

            {detailsOpen === r.id && (
              <div
                style={{
                  background: "#F7F7F7",
                  padding: 12,
                  borderRadius: 12,
                  marginTop: 10,
                }}
              >
                <pre style={{ whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(r, null, 2)}
                </pre>
              </div>
            )}

            {/* SITZUNGSLISTE */}
            {sessions[r.id] && sessions[r.id].length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h4 style={{ margin: "0 0 8px" }}>Vergangene Sitzungen:</h4>

                {sessions[r.id].map((s) => (
                  <div
                    key={s.id}
                    style={{
                      background: "#F9F9FF",
                      border: "1px solid #ddd",
                      padding: 8,
                      borderRadius: 10,
                      marginBottom: 6,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>🗓 {new Date(s.date).toLocaleString("de-DE")}</span>
                    <span>{s.duration_min} Min</span>
                    <span>€{s.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* BUTTONS je nach Status */}
            {r._status === "offen" && (
              <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                <button
                  onClick={() => handleMatch(r)}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    background: "#D5F8D5",
                    border: "1px solid #88C688",
                  }}
                >
                  ❤️ Match
                </button>

                <button
                  onClick={() => handleNoMatch(r)}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    background: "#FFD7D7",
                    border: "1px solid #E99999",
                  }}
                >
                  ❌ Kein Match
                </button>
              </div>
            )}

            {r._status === "active" && (
              <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                {/* nächste Sitzung */}
                <button
                  onClick={() => addSession(r)}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    background: "rgba(150,170,255,0.25)",
                    border: "1px solid #9AAAF5",
                    color: "#304085",
                    fontWeight: 600,
                  }}
                >
                  ➕ nächste Sitzung
                </button>

                {/* Coaching beenden */}
                <button
                  onClick={() => finishCoaching(r)}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    background: "#FFD7D7",
                    border: "1px solid #E99999",
                  }}
                >
                  🔴 Coaching beenden
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
