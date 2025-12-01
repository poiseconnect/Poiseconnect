"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// ---------------------------------------------
// 🔐 Dashboard: Teammitglied sieht NUR eigene Anfragen
// ---------------------------------------------
export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // ----------------------
  // 1) Benutzer holen
  // ----------------------
  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setUser(user);
    }

    loadUser();
  }, []);

  // ----------------------
  // 2) Anfragen aus DB laden
  // ----------------------
  useEffect(() => {
    if (!user) return;

    async function loadRequests() {
      setLoading(true);

      const { data, error } = await supabase
        .from("anfragen")
        .select("*")
        .eq("wunschtherapeut", user.email) // Nur eigene Anfragen
        .order("created_at", { ascending: false });

      if (error) console.error("DB LOAD ERROR:", error);

      setRequests(data || []);
      setLoading(false);
    }

    loadRequests();
  }, [user]);

  // -------------------------------------------------
  // 📌 BUTTON HANDLER
  // -------------------------------------------------

  // Termin bestätigen
  async function confirmAppointment(r) {
    await fetch("/api/confirm-appointment", {
      method: "POST",
      body: JSON.stringify({
        id: r.id,
        therapist: user.email,
        terminISO: r.bevorzugte_zeit_iso || r.terminISO || "",
      }),
    });

    alert("Termin bestätigt!");
    window.location.reload();
  }

  // Absagen
  async function rejectAppointment(r) {
    await fetch("/api/reject-appointment", {
      method: "POST",
      body: JSON.stringify({ id: r.id }),
    });

    alert("Termin wurde abgesagt.");
    window.location.reload();
  }

  // Weiterleiten
  async function forwardRequest(r) {
    await fetch("/api/forward-request", {
      method: "POST",
      body: JSON.stringify({ id: r.id }),
    });

    alert("Anfrage wurde weitergeleitet.");
    window.location.reload();
  }

  // Platzhalter für neuen Termin
  function newAppointment() {
    alert("Schritt 5: Resume=10 Link folgt als Nächstes.");
  }

  // -------------------------------------------------
  // UI Rendering
  // -------------------------------------------------
  if (!user) return <p>Wird geladen…</p>;
  if (loading) return <p>Anfragen werden geladen…</p>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Dashboard</h1>
      <p>Eingeloggt als <strong>{user.email}</strong></p>

      {requests.length === 0 && (
        <p>Keine offenen Anfragen für dich.</p>
      )}

      {requests.map((r) => (
        <div
          key={r.id}
          style={{
            marginTop: 20,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 12,
          }}
        >
          <h3>
            {r.vorname} {r.nachname}
          </h3>

          <p><strong>Email:</strong> {r.email}</p>
          <p><strong>Anliegen:</strong> {r.anliegen}</p>
          <p><strong>Ziel:</strong> {r.ziel}</p>

          {r.bevorzugte_zeit && (
            <p>
              <strong>Wunschtermin:</strong> {r.bevorzugte_zeit}
            </p>
          )}

          {r.status && (
            <p>
              <strong>Status:</strong> {r.status}
            </p>
          )}

          {/* BUTTONS */}
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <button
              onClick={() => confirmAppointment(r)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "#D4FCDD",
              }}
            >
              ✔ Termin bestätigen
            </button>

            <button
              onClick={() => rejectAppointment(r)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "#FFE0E0",
              }}
            >
              ✖ Absagen
            </button>

            <button
              onClick={newAppointment}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "#E8E8FF",
              }}
            >
              🔁 Neuen Termin
            </button>

            <button
              onClick={() => forwardRequest(r)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "#FFF4C2",
              }}
            >
              ➜ Weiterleiten
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
