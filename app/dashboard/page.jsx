"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);

  // ---------------------------------------------------
  // 1) Prüfen, ob Teammitglied eingeloggt ist
  // ---------------------------------------------------
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    }
    loadUser();
  }, []);

  // ---------------------------------------------------
  // 2) Anfragen laden ONLY für eigenen Login
  // ---------------------------------------------------
  useEffect(() => {
    if (!user?.email) return;

    async function load() {
      const { data, error } = await supabase
        .from("anfragen")
        .select("*")
        .eq("wunschtherapeut", user.email) // Teammitglied sieht NUR eigene Anfragen
        .order("id", { ascending: false });

      if (!error) setRequests(data || []);
    }

    load();
  }, [user]);

  // ---------------------------------------------------
  // 3) BUTTON: Termin bestätigen
  // ---------------------------------------------------
  async function confirmAppointment(req) {
    const res = await fetch("/api/therapist-response?action=confirm", {
      method: "POST",
      body: JSON.stringify({
        therapist: user.email,
        client: req.email,
        slot: req.bevorzugte_zeit,
      }),
    });

    if (!res.ok) {
      alert("Fehler beim Bestätigen!");
      return;
    }

    alert("Termin bestätigt 🤍");
    window.location.reload();
  }

  // ---------------------------------------------------
  // 4) BUTTON: Anfrage absagen
  // ---------------------------------------------------
  async function decline(req) {
    const res = await fetch("/api/decline", {
      method: "POST",
      body: JSON.stringify({
        id: req.id,
        email: req.email,
        therapist: user.email,
        vorname: req.vorname,
      }),
    });

    if (!res.ok) {
      alert("Fehler beim Absagen!");
      return;
    }

    alert("Klient wurde informiert (Absage).");
    window.location.reload();
  }

  // ---------------------------------------------------
  // 5) BUTTON: Neuen Termin auswählen (Schritt 5 → resume=10)
  // ---------------------------------------------------
  async function newAppointment(req) {
    const res = await fetch("/api/new-appointment", {
      method: "POST",
      body: JSON.stringify({
        id: req.id,
        email: req.email,
        therapist: user.email,
        vorname: req.vorname,
      }),
    });

    if (!res.ok) {
      alert("Fehler beim Senden!");
      return;
    }

    alert("Klient wählt neuen Termin aus.");
    window.location.reload();
  }

  // ---------------------------------------------------
  // 6) BUTTON: Anders Teammitglied (resume=5)
  // ---------------------------------------------------
  async function reassign(req) {
    const res = await fetch("/api/reassign", {
      method: "POST",
      body: JSON.stringify({
        id: req.id,
        email: req.email,
        vorname: req.vorname,
      }),
    });

    if (!res.ok) {
      alert("Fehler beim Weiterleiten!");
      return;
    }

    alert("Klient wählt jetzt ein anderes Teammitglied.");
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

      {requests.length === 0 && (
        <p>Noch keine Anfragen.</p>
      )}

      {requests.map((r) => (
        <div
          key={r.id}
          style={{
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 10,
            marginBottom: 16,
          }}
        >
          <h3>
            {r.vorname} {r.nachname}
          </h3>
          <p><strong>Email:</strong> {r.email}</p>
          <p><strong>Anliegen:</strong> {r.anliegen}</p>
          <p><strong>Bevorzugte Zeit:</strong> {r.bevorzugte_zeit || "Noch kein Termin gewählt"}</p>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>

            {/* BUTTON 1: Termin bestätigen */}
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

            {/* BUTTON 2: Absagen */}
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

            {/* BUTTON 3: Neuer Termin (Resume=10) */}
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

            {/* BUTTON 4: anderes Teammitglied (Resume=5) */}
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
