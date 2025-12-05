"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);

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
      const email = user.email.toLowerCase();

      // Basis-Query
      let query = supabase
        .from("anfragen")
        .select("*")
        .order("bearbeitet", { ascending: true })
        .order("id", { ascending: false });

      // Admin sieht alles
      if (email !== "hallo@mypoise.de") {
        query = query.eq("wunschtherapeut", user.email);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase Fehler beim Laden:", error);
        return;
      }

      setRequests(data || []);
    }

    load();
  }, [user]);

  // -------------------------
  // MARKIERUNG: Bearbeitet
  // -------------------------

  async function toggleDone(req, value) {
    const { error } = await supabase
      .from("anfragen")
      .update({ bearbeitet: value })
      .eq("id", req.id);

    if (error) {
      alert("Fehler beim Aktualisieren");
      return;
    }

    // sofort aktualisieren
    setRequests((prev) =>
      prev.map((r) =>
        r.id === req.id ? { ...r, bearbeitet: value } : r
      )
    );
  }

  // -------------------------
  // ANDERE FUNKTIONEN (Termin bestätigen usw.)
  // -------------------------

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
    alert("Klient wurde informiert.");
    window.location.reload();
  }

  async function newAppointment(req) {
    const res = await fetch("/api/new-appointment", {
      method: "POST",
      body: JSON.stringify({
        requestId: req.id,
        client: req.email,
        therapist: user.email,
      }),
    });

    if (!res.ok) return alert("Fehler beim Senden!");
    alert("Klient wählt neuen Termin aus.");
    window.location.reload();
  }

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

  // -------------------------
  // UI
  // -------------------------

  if (!user)
    return <div style={{ padding: 40 }}>Bitte per Magic Link einloggen…</div>;

  const isAdmin = user.email.toLowerCase() === "hallo@mypoise.de";

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
      <h1>Dashboard</h1>
      <p>
        Eingeloggt als <strong>{user.email}</strong>{" "}
        {isAdmin && <span style={{ color: "#888" }}>(Admin: alle Anfragen)</span>}
      </p>

      <hr style={{ margin: "20px 0" }} />

      <h2>{isAdmin ? "Alle Anfragen" : "Deine Anfragen"}</h2>

      {requests.map((r) => (
        <div
          key={r.id}
          style={{
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 10,
            marginBottom: 16,
            background: r.bearbeitet ? "#f5f5f5" : "#fffbe6",
          }}
        >
          <h3>
            {r.vorname} {r.nachname}{" "}
            {r.bearbeitet && (
              <span style={{ fontSize: 12, color: "green" }}>✔ bearbeitet</span>
            )}
          </h3>

          <p><strong>Email:</strong> {r.email}</p>
          <p><strong>Anliegen:</strong> {r.anliegen}</p>
          <p><strong>Bevorzugte Zeit:</strong> {r.bevorzugte_zeit || "–"}</p>
          <p><strong>Wunsch-Therapeut:</strong> {r.wunschtherapeut}</p>

          {/* BEARBEITET BUTTON */}
          <div style={{ marginTop: 12, marginBottom: 12 }}>
            {!r.bearbeitet ? (
              <button
                onClick={() => toggleDone(r, true)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #52c41a",
                  background: "#eaffea",
                }}
              >
                ✔ Als bearbeitet markieren
              </button>
            ) : (
              <button
                onClick={() => toggleDone(r, false)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #faad14",
                  background: "#fff7e6",
                }}
              >
                ↺ Als unerledigt markieren
              </button>
            )}
          </div>

          {/* ANDERE ACTION BUTTONS */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => confirmAppointment(r)}>✔ Termin bestätigen</button>
            <button onClick={() => decline(r)}>✖ Absagen</button>
            <button onClick={() => newAppointment(r)}>🔁 Neuen Termin</button>
            <button onClick={() => reassign(r)}>👥 Weiterleiten</button>
          </div>
        </div>
      ))}
    </div>
  );
}
