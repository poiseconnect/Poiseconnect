"use client";

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);

  // ---------------------------------------------------
  // 1) Magic-Link Login prüfen
  // ---------------------------------------------------
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    }
    loadUser();
  }, []);

  // ---------------------------------------------------
  // 2) Nur eigene Anfragen laden
  // ---------------------------------------------------
  useEffect(() => {
    if (!user?.email) return;

    async function load() {
      const { data, error } = await supabase
        .from("anfragen")
        .select("*")
        .eq("wunschtherapeut", user.email)
        .order("id", { ascending: false });

      if (!error) setRequests(data || []);
    }
    load();
  }, [user]);

  // ---------------------------------------------------
  // 3) TERMIN BESTÄTIGEN
  // ---------------------------------------------------
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

  // ---------------------------------------------------
  // 4) ABSAGEN
  // ---------------------------------------------------
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

  // ---------------------------------------------------
  // 5) NEUER TERMIN (Resume=10)
  // ---------------------------------------------------
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

  // ---------------------------------------------------
  // 6) ANDERES TEAMMITGLIED (Resume=5)
  // ---------------------------------------------------
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

  // ---------------------------------------------------
  // UI
  // ---------------------------------------------------
  if (!user)
    return <div style={{ padding: 40 }}>Bitte per Magic Link einloggen…</div>;

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
      <h1>Dashboard</h1>
      <p>Eingeloggt als <strong>{user.email}</strong></p>

      <hr style={{ margin: "20px 0" }} />

      <h2>Deine Anfragen</h2>

      {requests.length === 0 && <p>Noch keine Anfragen.</p>}

      {requests.map((r) => (
        <div
          key={r.id}
          style={{
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 10,
            marginBottom: 16,
            background: "#fafafa",
          }}
        >
          <h3>
            {r.vorname} {r.nachname}
          </h3>
          <p><strong>Email:</strong> {r.email}</p>
          <p><strong>Anliegen:</strong> {r.anliegen}</p>
          <p>
            <strong>Bevorzugte Zeit:</strong>{" "}
            {r.bevorzugte_zeit || "Noch kein Termin gewählt"}
          </p>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => confirmAppointment(r)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "#D4F8D4",
                border: "1px solid #8BC48B",
              }}
            >
              ✔ Termin bestätigen
            </button>

            <button
              onClick={() => decline(r)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "#FFDADA",
                border: "1px solid #E88",
              }}
            >
              ✖ Absagen
            </button>

            <button
              onClick={() => newAppointment(r)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "#E8E8FF",
                border: "1px solid #9990ff",
              }}
            >
              🔁 Neuen Termin
            </button>

            <button
              onClick={() => reassign(r)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "#FFF1D6",
                border: "1px solid #E0B96F",
              }}
            >
              👥 anderes Teammitglied
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
