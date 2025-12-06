"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const STATUS_LABELS = {
  neu: "Neu",
  termin_bestaetigt: "Termin bestätigt",
  termin_neu: "Neuen Termin wählen",
  abgesagt: "Abgesagt",
  weitergeleitet: "Weitergeleitet",
};

const STATUS_COLORS = {
  neu: { bg: "#FFF7EC", border: "#E3C29A", text: "#8B5A2B" },              // Beige
  termin_bestaetigt: { bg: "#EAF8EF", border: "#9AD0A0", text: "#2F6E3A" }, // Grün
  termin_neu: { bg: "#EFF3FF", border: "#9AAAF5", text: "#304085" },        // Blau
  abgesagt: { bg: "#FEECEC", border: "#F1A5A5", text: "#8B1E2B" },          // Rot
  weitergeleitet: { bg: "#F9F5FF", border: "#C8B0F5", text: "#54358B" },    // Lila
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("neu"); // "neu" | "bearbeitet" | "alle"
  const [loading, setLoading] = useState(true);

  // 1) Magic-Link Login prüfen
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    }
    loadUser();
  }, []);

  // 2) Anfragen laden
  useEffect(() => {
    if (!user?.email) return;

    async function load() {
      setLoading(true);
      const email = user.email.toLowerCase();

      let query = supabase
        .from("anfragen")
        .select("*")
        .order("id", { ascending: false });

      // Admin sieht alle, andere nur eigene
      if (email !== "hallo@mypoise.de") {
        query = query.eq("wunschtherapeut", user.email);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase Fehler beim Laden:", error);
        setRequests([]);
      } else {
        setRequests(data || []);
      }

      setLoading(false);
    }

    load();
  }, [user]);

  // 3) Termin bestätigen
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

    if (!res.ok) return alert("Fehler beim Bestätigen!");
    alert("Termin bestätigt 🤍");
    window.location.reload();
  }

  // 4) Absagen
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

    if (!res.ok) return alert("Fehler beim Absagen!");
    alert("Klient wurde informiert (Absage).");
    window.location.reload();
  }

 // 5) Neuer Termin
async function newAppointment(req) {
  const res = await fetch("/api/new-appointment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId: req.id,
      client: req.email,                // Klient:in
      therapistEmail: user.email,       // eingeloggtes Teammitglied / Admin
      therapistName: req.wunschtherapeut, // 🔥 WICHTIG: Name aus der Anfrage, z.B. "Ann"
      vorname: req.vorname,
    }),
  });

  if (!res.ok) {
    alert("Fehler beim Senden!");
    return;
  }

  alert("Klient:in bekommt einen Link zur neuen Terminauswahl.");
  window.location.reload();
}

  // 6) Weiterleiten an anderes Teammitglied
  async function reassign(req) {
    const res = await fetch("/api/forward-request", {
      method: "POST",
      body: JSON.stringify({
        requestId: req.id,
        client: req.email,
        vorname: req.vorname,
      }),
    });

    if (!res.ok) return alert("Fehler beim Weiterleiten!");
    alert("Anfrage wurde weitergeleitet.");
    window.location.reload();
  }

  // 7) Filter anwenden
  const filteredRequests = requests.filter((r) => {
    const status = (r.status || "neu").toLowerCase();

    if (filter === "neu") {
      return status === "neu" || status === "";
    }

    if (filter === "bearbeitet") {
      return status !== "neu" && status !== "";
    }

    return true; // "alle"
  });

  // ----------------- UI -----------------
  if (!user)
    return (
      <div style={{ padding: 40 }}>
        Bitte per Magic Link einloggen…
      </div>
    );

  const isAdmin = user.email.toLowerCase() === "hallo@mypoise.de";

  const countNeu = requests.filter(
    (r) => (r.status || "neu").toLowerCase() === "neu" || !r.status
  ).length;
  const countBearbeitet = requests.length - countNeu;

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
            Eingeloggt als <strong>{user.email}</strong>{" "}
            {isAdmin && (
              <span style={{ color: "#A3754A" }}>
                · Admin-Ansicht (alle Anfragen)
              </span>
            )}
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
              background:
                filter === "neu" ? "#FFFFFF" : "transparent",
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
              background:
                filter === "bearbeitet" ? "#FFFFFF" : "transparent",
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
              background:
                filter === "alle" ? "#FFFFFF" : "transparent",
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
        <p style={{ color: "#777" }}>Keine Anfragen in diesem Filter.</p>
      )}

      {!loading &&
        filteredRequests.map((r) => {
          const statusKey = (r.status || "neu").toLowerCase();
          const label = STATUS_LABELS[statusKey] || "Neu";
          const colors =
            STATUS_COLORS[statusKey] || STATUS_COLORS["neu"];

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
                  <span>{label}</span>
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

              <p
                style={{
                  margin: "4px 0",
                  fontSize: 13,
                  color: "#555",
                }}
              >
                <strong>Bevorzugte Zeit:</strong>{" "}
                {r.bevorzugte_zeit || "Noch kein Termin gewählt"}
              </p>

              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  color: "#999",
                }}
              >
                ID: #{r.id}
              </p>

              {/* Aktionen */}
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => confirmAppointment(r)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "#D4F8D4",
                    border: "1px solid #8BC48B",
                    fontSize: 13,
                    cursor: "pointer",
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
                    border: "1px solid #E88",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  ✖ Absagen
                </button>

                <button
                  onClick={() => newAppointment(r)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "#E8E8FF",
                    border: "1px solid #9990ff",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  🔁 Neuen Termin
                </button>

                <button
                  onClick={() => reassign(r)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "#FFF1D6",
                    border: "1px solid #E0B96F",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  👥 anderes Teammitglied
                </button>
              </div>
            </article>
          );
        })}
    </div>
  );
}
